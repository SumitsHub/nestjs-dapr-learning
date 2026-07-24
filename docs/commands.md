# Dapr Command Reference

## Quick Start (recommended)

Start infra + all four sidecars with two commands:

```bash
yarn infra:up      # RabbitMQ + Mongo via docker compose
yarn dapr:up       # all four services via dapr run -f .
```

Stop them:

```bash
yarn dapr:down
yarn infra:down
```

**UIs to keep open while developing:**

- RabbitMQ: <http://localhost:15672> (admin / admin)
- Zipkin (distributed tracing): <http://localhost:9411>

Individual service scripts (useful when debugging one at a time):

```bash
yarn dapr:order
yarn dapr:payment
yarn dapr:inventory
yarn dapr:notification
```

List running Dapr apps:

```bash
yarn dapr:list
```

The multi-app config lives in [`dapr.yaml`](../dapr.yaml).

---

## Live-Reload During Development

Two ways to run the stack, choose per situation:

| Command             | Uses               | App code changes                                    |
| ------------------- | ------------------ | --------------------------------------------------- |
| `yarn dapr:up`       | `dapr.yaml`         | Requires `dapr:down && dapr:up` to pick up.          |
| `yarn dapr:up:watch` | `dapr.dev.yaml`     | Rebuild + restart automatically (~500ms per change). |

Both use the same components, config, and ports. Watch mode simply
wraps each `nest start` with `--watch`. Dapr's sidecar keeps running
across app restarts — it retries the app port automatically.

**What auto-reloads without ANY restart, in either mode:**

- Component YAMLs (`dapr/components/*.yaml`) — new state store,
  changed connection string, added outbox metadata, etc.
- Resiliency policies (`dapr/resiliency/*.yaml`).
- Configuration resources (`dapr/config/tracing.yaml`).

You'll see a `Loading …` line in the sidecar log the moment you save
one of these. This is Dapr's built-in hot-reload — no code required.

**What DOES require a restart:**

- Anything in `dapr.yaml` / `dapr.dev.yaml` itself (ports, app IDs,
  gRPC pin, resource-paths list). Read once at `dapr run` boot.
- The list of environment variables passed to each app.

---

## Troubleshooting

### `Port 3500 is not available` on `yarn dapr:up`

**Symptom:**

```text
❌  Error validating run config for app "order-service": invalid configuration for HTTPPort. Port 3500 is not available
```

**Root cause.** `dapr run -f dapr.yaml` supervises two child
processes per service: the Dapr sidecar (`daprd`) and the app
(`nest start <svc>`, which itself forks `node dist/apps/<svc>/main`).
If the parent CLI dies unexpectedly (terminal crash, `kill -9` on the
wrong PID, a `dapr stop` that only killed the CLI), those children
are re-parented and keep running. Ports stay bound.

You can confirm this with `dapr list` — the tell-tale sign is:

```text
DAPRD PID  CLI PID  APP PID
216862     0        0        ← CLI is dead, sidecar is orphaned
```

The graceful `dapr stop -f dapr.yaml` will not help — it looks for a
coordinator that no longer exists.

**The 3-level cleanup this project's `yarn dapr:down` performs:**

1. `dapr stop -f dapr.yaml` — happy path when the CLI is alive.
2. `dapr stop --app-id <id>` for each of the 4 apps — kills the
   orphaned `daprd` processes.
3. `pkill -f "dist/apps/<svc>/main"` for each service — kills the
   orphaned `node` process that `nest start` originally forked.
   (`pkill -f "nest start ..."` does not work: `nest start` is only
   the parent CLI, and it died at the same time as its own parent.)

**Manual recovery** (if you want to see it step by step):

```bash
# 1. Show the orphans
yarn dapr:doctor

# 2. Cleanup
yarn dapr:down

# 3. Confirm all ports are free
yarn dapr:doctor
```

**Last-resort nuclear option** (kills every daprd and every nest child on the box):

```bash
pkill -f daprd
pkill -f 'dist/apps/.*-service/main'
```

### `dapr:doctor` — read-only inspector

Reports:

- What `dapr list` sees
- Which of ports 3000-3003, 3500-3503 are held and by whom
- All `daprd` + compiled-nest-service processes with their ages

Safe to run any time. Never kills anything.

### Why the app ports stay held after Ctrl+C

Ctrl+C sends SIGINT to the foreground process group. In some
terminals (especially over SSH or WSL), the signal is delivered to
`dapr` but not always to grand-children like the forked node process.
That's exactly the orphan scenario above. The fix is the same:
`yarn dapr:down`.

---

## Initial HTTP Version (No Dapr)

Payment Service

```bash
yarn nest start payment-service
```

Order Service

```bash
yarn nest start order-service
```

Communication:

```text
Order Service
    |
    v
http://localhost:3001/payments
```

---

## Dapr Service Invocation Version

Payment Service

```bash
dapr run \
  --app-id payment-service \
  --app-port 3001 \
  --dapr-http-port 3501 \
  --resources-path ./dapr/components \
  -- yarn nest start payment-service
```

Order Service

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  -- yarn nest start order-service
```

Inventory Service

```bash
dapr run \
  --app-id inventory-service \
  --app-port 3002 \
  --dapr-http-port 3502 \
  --resources-path ./dapr/components \
  -- yarn nest start inventory-service
```

Notification Service

```bash
dapr run \
  --app-id notification-service \
  --app-port 3003 \
  --dapr-http-port 3503 \
  --resources-path ./dapr/components \
  -- yarn nest start notification-service
```

Communication:

```text
Order Service
    |
localhost:3500
    |
    v
payment-service (app-id)
```

Invocation URL:

```text
http://localhost:3500/v1.0/invoke/payment-service/method/payments
```

---

## Useful Verification Commands

Check installed version:

```bash
dapr version
```

List running Dapr applications:

```bash
dapr list
```

Verify sidecar metadata:

```bash
curl http://localhost:3500/v1.0/metadata
```

or

```bash
curl http://localhost:3501/v1.0/metadata
```

Verify subscription discovery endpoint:

```bash
curl http://localhost:3001/dapr/subscribe
```

---

## Infrastructure Commands

Start RabbitMQ:

```bash
cd infra
docker compose up -d
```

Stop RabbitMQ:

```bash
docker compose down
```

Verify RabbitMQ:

```bash
docker ps | grep rabbitmq
```

RabbitMQ UI:

```text
http://localhost:15672
```

Credentials:

```text
admin / admin
```

---

## Architecture Evolution

### Phase 1

```text
Order Service
      |
      v
Payment Service
```

Direct HTTP

---

### Phase 2

```text
Order Service
      |
      v
Order Dapr Sidecar
      |
      v
Payment Dapr Sidecar
      |
      v
Payment Service
```

Service Invocation

---

### Phase 3 (Current Goal)

```text
Order Service
      |
Publish Event
      |
      v
RabbitMQ
      |
      v
Payment Service
```

Pub/Sub

```

```

## Generate library

nest g library dapr-core

## Generate service

nest g app inventory-service
