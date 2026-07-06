# Lesson 13 - Observability with Zipkin

## Goal

See the full choreography chain as a single distributed trace, with one
span per service hop. Turn the invisible event flow into a picture.

---

## Why Observability Matters

Yesterday we shipped this chain:

```text
Order → Payment → Inventory → Notification
```

If any of the four services misbehaves, today the only diagnostic tool
is `console.log` scattered across four terminals. That works for two
services. It breaks down at four. It is impossible at forty.

Distributed tracing solves this by attaching a single **trace ID** to
the very first request and threading it through every downstream call
via the W3C `traceparent` header.

Dapr does this for free — the sidecar injects and forwards
`traceparent` on every Service Invocation and Pub/Sub call.

---

## Three Signals in Observability

| Signal   | Question it answers                          | Tool used here |
| -------- | -------------------------------------------- | -------------- |
| Traces   | *Where did the time go for this request?*    | Zipkin         |
| Metrics  | *How many requests, how fast, how many fail?*| (Prometheus — later) |
| Logs     | *What exactly happened at this instant?*     | stdout / files |

This lesson focuses on **traces**.

---

## What Was Added

### 1. Zipkin container

`infra/docker-compose.yml`:

```yaml
zipkin:
  image: openzipkin/zipkin:latest
  container_name: zipkin
  ports:
    - "9411:9411"
```

UI: <http://localhost:9411>

### 2. Dapr Configuration resource

`dapr/config/tracing.yaml`:

```yaml
apiVersion: dapr.io/v1alpha1
kind: Configuration
metadata:
  name: tracing
spec:
  tracing:
    samplingRate: "1"
    zipkin:
      endpointAddress: "http://localhost:9411/api/v2/spans"
```

Key points:

- `kind: Configuration` — **not** a Component. Components define
  external resources (state stores, brokers). Configurations tune the
  sidecar itself.
- `samplingRate: "1"` = 100%. In production, drop to `"0.1"` (10%).
- The endpoint is Zipkin's OpenAPI v2 spans ingestion path.

### 3. Wired via multi-app run

`dapr.yaml`:

```yaml
common:
  resourcesPath: ./dapr/components
  configFilePath: ./dapr/config/tracing.yaml
```

The individual `yarn dapr:order` / `dapr:payment` scripts also pass
`--config ./dapr/config/tracing.yaml` so tracing works in isolation.

---

## The Bug This Lesson Also Fixed

While setting up tracing, we noticed every service was constructing
its `DaprClient` with `daprPort: '3500'` — order-service's sidecar.

```ts
// BEFORE (in 5 places)
this.client = new DaprClient({
  daprHost: '127.0.0.1',
  daprPort: '3500',        // wrong for payment (3501), inventory (3502), etc.
});
```

Why it "worked" in local dev:

- All components are loaded from the same `--resources-path` on every
  sidecar, so any sidecar can save to any Mongo collection or publish
  to any topic.

Why it silently corrupts the system:

- **Traces attribute every DB write and every publish to `order-service`.**
  The Zipkin view would collapse into "order-service did everything".
- **In production, sidecars are per-pod.** Payment service pod cannot
  reach `localhost:3500` — there is no order-service sidecar there.
  The service breaks the moment it deploys.
- **Multi-replica scaling is impossible** because the port is
  ambiguous when there are three order-service pods.

### The fix — single factory

`libs/dapr-core/src/dapr-client.factory.ts`:

```ts
export function createDaprClient(): DaprClient {
  return new DaprClient({
    daprHost: process.env.DAPR_HOST ?? '127.0.0.1',
    daprPort: process.env.DAPR_HTTP_PORT ?? '3500',
  });
}
```

`DAPR_HTTP_PORT` is auto-exported by `dapr run` into the child process.
Every state/secret/pubsub/invocation service now uses this factory,
which means each service talks to its *own* sidecar. The 5 hardcoded
port strings became one line of code, in one file.

### Bonus type-safety

`PubSubService.publish` gained a generic:

```ts
async publish<T = unknown>(topic: string, data: T): Promise<void>
```

Combined with typing the payload at the call site
(`const evt: PaymentCompletedEvent = {...}`), field-drift bugs like
the missing `items` from Lesson 12 are now caught at compile time.

---

## Running the Traced Chain

```bash
yarn infra:up      # starts RabbitMQ + Mongo + Zipkin
yarn dapr:up       # starts all 4 sidecars with tracing config
```

Trigger the chain:

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ORD-TRACE-001","amount":250}'
```

Open Zipkin: <http://localhost:9411>

Click **Run Query**. You should see a trace with roughly this shape:

```text
▼ CallLocal /orders (order-service)                                  120 ms
    ▼ PublishEvent order-created (order-service → pubsub)              5 ms
        ▼ CallLocal /orders/order-created (payment-service)           40 ms
            ▼ PublishEvent payment-completed                           4 ms
                ▼ CallLocal /inventory/payment-completed              35 ms
                    ▼ PublishEvent inventory-reserved                  3 ms
                        ▼ CallLocal /notification/inventory-reserved  25 ms
                            ▼ PublishEvent notification-sent           3 ms
```

Every span carries the same `traceId`. Click any span for
`traceparent`, service name, and duration.

---

## Reading a Trace — What to Look For

1. **Total wall time** — top-level span duration.
2. **Which hop dominates** — the widest bar is your slowest step.
3. **Async boundaries** — Pub/Sub spans end when the sidecar accepts
   the message, *not* when the consumer finishes. Consumer spans are
   linked by trace ID but start later.
4. **Missing spans** — if a downstream service does not appear, its
   sidecar either did not receive the message or dropped the trace
   header.

---

## Interview Angles

**Q. What is a trace and what is a span?**

A trace is one end-to-end request. A span is one unit of work inside
it. Spans nest to form the trace tree.

**Q. Who generates the `traceparent` header?**

The first sidecar that sees the request. It is a W3C standard header:
`traceparent: 00-<traceId>-<spanId>-<flags>`.

**Q. How does Dapr propagate it across Pub/Sub?**

Dapr writes `traceparent` into the CloudEvent envelope so the consumer
sidecar can pick it up and continue the trace.

**Q. Why not just use OpenTelemetry directly?**

You can. Dapr's tracing is OpenTelemetry-compatible; you can swap the
exporter to OTLP and send to Jaeger, Tempo, Honeycomb, Datadog, etc.
Dapr just gives you zero-code instrumentation of the sidecar hops.

**Q. Cost of `samplingRate: 1` in production?**

At scale, every request generates spans; span storage and network I/O
cost adds up fast. Typical production values: 0.01–0.1 (1–10%) with
head-based sampling, plus 100% sampling of error traces via tail
sampling.

---

## Known Latent Issues Still Open

1. **Dual-write in `order-service`** — save-to-Mongo and publish-event
   are two separate calls. → *Next lesson: Transactional Outbox.*
2. **No subscriber-side retry / dead letter topic** — a permanent
   error in `payment-service` just logs and dies. → *Next lesson: Pub/Sub Reliability.*
3. **No metrics dashboard yet** — Dapr exposes Prometheus metrics on
   port 9090 per sidecar. → *Future lesson: Metrics + Grafana.*

---

## Recap

- Zipkin running at `:9411`, receiving spans from all four sidecars
- End-to-end trace shows exact shape of the choreography chain
- Fixed the "everything routed through port 3500" latent bug that
  would have made this whole exercise misleading
- Introduced `createDaprClient()` — one source of truth for sidecar
  connection config
- `PubSubService.publish<T>` now catches missing-field bugs at compile time
