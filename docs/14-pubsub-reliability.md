# Lesson 14 - Pub/Sub Reliability & Dead Letter Topics

## Goal

Bound retries on the subscriber side, and route messages that fail
permanently to a **dead letter topic** (DLQ) instead of blocking the
queue forever.

Answers the question from `INTERVIEW_NOTES.md`:
*"Retries didn't trigger when Payment Service was stopped."*
They will now — but on the **subscriber** side, which is the side that
actually matters.

---

## Why This Matters

A subscriber can fail in three fundamentally different ways:

| Failure                        | Correct response         | Wrong response                    |
| ------------------------------ | ------------------------ | --------------------------------- |
| Transient (DB timeout)         | Retry, eventually succeed | Drop → data loss                 |
| Permanent (bad payload)        | Route to DLQ, move on    | Retry forever → poison the queue  |
| Consumer crash                 | Broker redelivers        | Manual replay by ops              |

Without a DLQ, a single bad message can block every downstream event
behind it. RabbitMQ (via Dapr) will nack-and-redeliver indefinitely
until the subscriber returns 2xx.

---

## The Two Knobs

Dapr splits this into two orthogonal concerns:

1. **How many times to retry** → a `Resiliency` policy targeting the
   pubsub component's `inbound` path.
2. **Where to send the message after retries are exhausted** →
   `deadLetterTopic` field on the subscription itself.

Both are needed. Without the retry cap, the DLQ never triggers because
the runtime keeps retrying forever.

---

## The Retry Policy

`dapr/resiliency/payment-resiliency.yaml`:

```yaml
spec:
  policies:
    retries:
      pubsubInboundRetry:
        policy: exponential
        maxInterval: 10s
        maxRetries: 3

  targets:
    components:
      pubsub:
        inbound:
          retry: pubsubInboundRetry
```

Meaning:

- **exponential** — 1s, 2s, 4s, 8s, capped at 10s
- **maxRetries: 3** — 4 total attempts (1 initial + 3 retries)
- **inbound** — applies to messages *arriving at* subscribers via this
  pubsub component. `outbound` would apply to publish calls.

---

## The Dead Letter Topic

The subscription now declares:

```ts
{
  pubsubname: 'pubsub',
  topic: TOPICS.ORDER_CREATED,
  route: 'orders/order-created',
  deadLetterTopic: TOPICS.PAYMENT_FAILED,   // ← NEW
}
```

Behavior:

```text
OrderCreated arrives
      │
      ▼
handler throws → HTTP 500 → Nack
      │
      ▼        (up to maxRetries times)
Redelivered
      │
      ▼        (still failing)
Runtime forwards CloudEvent to `payment-failed`
      │
      ▼
DLQ subscriber logs / persists / alerts
```

The DLQ receives the **original CloudEvent unchanged**. All headers
(including `traceparent`) are preserved, so the failed trace still
shows up in Zipkin.

---

## The DLQ Handler

Also in the same service, subscribing to its own DLQ:

```ts
{
  pubsubname: 'pubsub',
  topic: TOPICS.PAYMENT_FAILED,
  route: 'payments/dead-letter',
}
```

```ts
@Post('/payments/dead-letter')
async handleDeadLetter(@Body() event: CloudEvent<OrderCreatedEvent>) {
  console.error('[DLQ] Payment permanently failed');
  console.error('[DLQ] orderId :', event.data?.orderId);
  return { success: true };   // 200 = drop from queue
}
```

Production versions would:

- Persist the failed event to a `dead_letters` collection
- Emit a metric so alerts fire
- Expose a "replay" admin endpoint

---

## Where Should the DLQ Handler Live?

Three legitimate options — pick per your ops model:

| Location                                       | Pro                                                    | Con                                             |
| ---------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **Same service that failed** (what we do)      | Owns the failure and knows how to interpret the payload | If the service is down, DLQ backs up too        |
| **Dedicated `dead-letter-handler` service**    | Never affected by the failing service                  | Extra service to run and deploy                 |
| **Broker-native DLQ** (RabbitMQ x-dead-letter) | No app code needed                                     | Bypasses Dapr, loses `traceparent` propagation  |

For this project, in-service is the simplest and most educational choice.

---

## Testing the Poison Message

The `payment-service` subscription now checks for a poison prefix:

```ts
if (event.data.orderId?.startsWith('FAIL-')) {
  throw new Error(`Simulated permanent failure for orderId=${event.data.orderId}`);
}
```

Restart everything so the new resiliency policy is loaded:

```bash
yarn dapr:down
yarn dapr:up
```

Send a poisoned order:

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"FAIL-500","amount":999}'
```

Expected timeline in the `payment-service` terminal:

```text
Received OrderCreated event                            ← attempt 1
Error: Simulated permanent failure for orderId=FAIL-500
Received OrderCreated event                            ← attempt 2 (~1s later)
Error: Simulated permanent failure ...
Received OrderCreated event                            ← attempt 3 (~2s later)
Error: Simulated permanent failure ...
Received OrderCreated event                            ← attempt 4 (~4s later)
Error: Simulated permanent failure ...
=================================================
[DLQ] Payment permanently failed — moved to DLQ
[DLQ] orderId : FAIL-500
=================================================
```

The DLQ block appears **once**, after retries are exhausted.

In Zipkin, the failed trace shows all 4 handler attempts as child
spans under a single `PublishEvent order-created` root, followed by a
sibling `PublishEvent payment-failed` from the runtime.

---

## Common Pitfalls

1. **Forgetting the retry cap** → DLQ never triggers. Symptom:
   `payment-service` logs the same error every few seconds forever.
2. **Returning 2xx from the failing handler** → Dapr treats it as
   success and does not retry. Only 4xx/5xx (or a body with
   `status: "RETRY"`) triggers redelivery.
3. **Naming the DLQ topic the same as an existing one** → causes an
   infinite loop if the DLQ handler also fails and forwards to itself.
4. **Ignoring the DLQ handler's own failures** → the DLQ handler is
   also just a subscription; if it throws and has its own
   `deadLetterTopic`, you get a DLQ-of-DLQ chain. Usually the DLQ
   handler should be idempotent and cheap (log/persist only), never
   call external services.

---

## Interview Angles

**Q. What's the difference between a retry policy and a DLQ?**

Retries handle *transient* failures. DLQ handles *permanent* failures.
You need both. A DLQ without bounded retries never fires; retries
without a DLQ mean poison messages block the queue forever.

**Q. How do you decide `maxRetries`?**

Rule of thumb: enough retries that the transient failure has plausibly
resolved (e.g. a database restart), but few enough that operators
aren't waiting hours to see a real problem. 3–5 with exponential
backoff is common.

**Q. Why exponential instead of constant backoff?**

Constant retries during an outage amplify load on the recovering
dependency (the "thundering herd" problem). Exponential backoff spreads
retries out, giving the downstream time to recover.

**Q. Can a DLQ handler itself be reliable?**

Yes, if you keep it dumb. Persist to append-only storage, emit a
metric, done. Every side effect the DLQ handler performs is a new
failure mode.

---

## Known Latent Issues Still Open

1. **Dual-write in `order-service`** — save Mongo + publish event are
   two operations. → *Next lesson: Transactional Outbox.*
2. **Idempotency** — if the payment handler succeeded but the ack was
   lost, the next retry will double-process. → *Follow-up: dedupe key
   in the state store.*
3. **Metrics dashboard** — retries and DLQ count are already emitted
   as Prometheus metrics by the sidecar. → *Future: Grafana lesson.*

---

## Recap

- Bounded pubsub inbound retries via a Resiliency policy
- Declared `deadLetterTopic` on the OrderCreated subscription
- Added a DLQ handler in the same service
- Proved the flow with a `FAIL-` poison prefix — retries visible in
  logs, final message diverted to the DLQ topic
- `traceparent` preserved end-to-end (visible in Zipkin)
