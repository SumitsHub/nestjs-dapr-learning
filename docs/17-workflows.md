# Lesson 17 - Dapr Workflows

## Goal

Rebuild the order saga using **orchestration** instead of choreography.
One central "conductor" describes the whole flow as ordinary code;
Dapr makes it durable, resumable, and centrally observable.

---

## Choreography vs Orchestration (recap with weight)

We've been using **choreography** since Lesson 12:

```text
order-service → order-created  → payment-service → payment-completed
                                → inventory-service → inventory-reserved
                                → notification-service
```

Every service listens for events and decides on its own what to do next.

Pros: loose coupling, independent deployment, easy to add subscribers.

Cons that grow with scale:
- The saga's shape is implicit — you have to trace it by grepping code
  across 4 repos.
- No single place to answer *"what step is order X on right now?"*
- Compensations are hard: if inventory can't reserve, who tells
  payment to refund?
- Timeouts are hard: nothing owns the "if the whole flow hasn't
  completed in 60s, abort" logic.

**Orchestration** flips it: one service owns the flow. It calls each
step explicitly and waits for its result.

```text
OrderSagaWorkflow (in order-service):
  payment       = call payment-service /payments
  reservation   = call inventory-service /inventory/reserve
  notification  = call notification-service /notifications/send
  return { status: COMPLETED, ... }
```

The saga is now a **piece of code you can read top-to-bottom**.

---

## Why Dapr Workflows over "just call them in a Nest service"?

You could write that saga as a plain async function calling three
services. It would work — until:

- The process crashes between steps 2 and 3. → The whole thing rolls
  back? Or you resume from scratch? Or does step 2 leave a half-done
  reservation?
- A step takes 45 seconds. → Your HTTP client times out; your database
  connection drops; you can't tell whether it succeeded.
- You need to schedule "send reminder in 3 days if no ack". → You now
  need a scheduler, a persistent job store, and reconciliation code.

Dapr Workflows solve this by giving you **durable functions**:

- Every activity result is checkpointed to a state store.
- If the process dies, another replica resumes at the last checkpoint.
- Timers, external events, and waits are first-class.
- Actor-based execution model gives you per-instance single-threading
  for free.

You write ordinary generator functions; Dapr handles the plumbing.

---

## What Was Added

### Component

`dapr/components/workflowstore.yaml` — Redis, but with one extra
metadata key:

```yaml
- name: actorStateStore
  value: 'true'
```

Workflows are built on Actors, and Actors need a state store that
opts in via `actorStateStore: true`. Without this key you'll get
*"no state store configured for actors"* at startup.

### Direct-invocation endpoints on downstream services

The workflow's activities call downstream services via Dapr Service
Invocation, so they need HTTP endpoints (not pubsub subscriptions):

- `payment-service`: `POST /payments` (already existed)
- `inventory-service`: `POST /inventory/reserve` (added)
- `notification-service`: `POST /notifications/send` (added)

These are *thin* — they run the same business logic as the pubsub
handlers but skip the outbound publish, because the orchestrator
owns "what happens next".

### The workflow module

Under `apps/order-service/src/workflow/`:

```text
activities/
  process-payment.activity.ts     ← call payment-service
  reserve-inventory.activity.ts   ← call inventory-service
  send-notification.activity.ts   ← call notification-service
order-saga.workflow.ts            ← the saga (a generator function)
workflow-runtime.service.ts       ← boots WorkflowRuntime on module init
workflow-client.service.ts        ← wraps DaprWorkflowClient
workflow.controller.ts            ← REST endpoints
workflow.module.ts                ← Nest module wiring
```

### gRPC port

The Node.js Workflow SDK talks gRPC to the sidecar (not HTTP). We
pinned order-service's gRPC port in `dapr.yaml`:

```yaml
- appID: order-service
  daprGRPCPort: 50001
```

Without a pin, the port is randomized on each start and the workflow
client can't find the sidecar.

---

## The Saga Function

```ts
export function* orderSagaWorkflow(
  ctx: WorkflowContext,
  input: CreateOrderDto,
): Generator<unknown, OrderSagaResult> {
  const orderCreated = { ...input, ... };

  const payment      = yield ctx.callActivity(processPaymentActivity, orderCreated);
  const reservation  = yield ctx.callActivity(reserveInventoryActivity, payment);
  const notification = yield ctx.callActivity(sendNotificationActivity, reservation);

  return { status: 'COMPLETED', paymentId: payment.paymentId, ... };
}
```

Two things to internalise:

**1. It's a generator function (`function*`).** Every `yield` is a
*durable* suspension point. The Dapr runtime:
- Records the pending activity call.
- Serializes the whole workflow state to Redis.
- Suspends the function.
- When the activity returns, it replays the function from the top
  (yes, from the top), fast-forwarding through every previous yield
  using recorded history, until it reaches the pending yield and
  resumes with the activity's result.

That's why:

**2. The workflow body must be deterministic.** No `Math.random()`,
no `Date.now()`, no direct DB calls, no HTTP calls, no console.log
that matters. Anything non-deterministic must live in an activity
(which runs exactly once, is recorded, and never replayed). Use
`ctx.getCurrentUtcDateTime()` if you need "now" — that value is
recorded on first execution and replays with the same result.

---

## Activities Are Just Functions

```ts
export const processPaymentActivity = async (
  _ctx: WorkflowActivityContext,
  input: OrderCreatedEvent,
): Promise<PaymentCompletedEvent> => {
  const response = await daprClient.invoker.invoke(
    'payment-service', 'payments', HttpMethod.POST,
    { orderId: input.orderId, amount: input.amount },
  );
  return { paymentId: response.paymentId, ... };
};
```

Rules:

- Activities are **not** replayed. They run once, their return value
  is checkpointed, and the workflow gets that value on next replay.
- Activities **should be idempotent** — Dapr may retry them if the
  workflow is stopped between "activity started" and "activity result
  recorded".
- Activities can call anything (databases, HTTP, other services).
  Non-determinism is fine here.

---

## Running It

Start everything:

```bash
yarn infra:up
yarn dapr:down && yarn dapr:up
```

Kick off a workflow:

```bash
curl -X POST http://localhost:3000/orders/workflow \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ORD-WF-1","amount":999}'
```

Response:

```json
{ "instanceId": "df3c...", "statusUrl": "/orders/workflow/df3c..." }
```

Poll status:

```bash
curl http://localhost:3000/orders/workflow/df3c...
```

Response after completion:

```json
{
  "instanceId": "df3c...",
  "status": "COMPLETED",
  "createdAt": "2026-07-06T...",
  "lastUpdatedAt": "2026-07-06T...",
  "input": "{\"orderId\":\"ORD-WF-1\",\"amount\":999}",
  "output": "{\"orderId\":\"ORD-WF-1\",\"status\":\"COMPLETED\",\"paymentId\":\"...\",\"reservationId\":\"...\",\"notificationId\":\"...\"}"
}
```

Terminate a stuck instance:

```bash
curl -X DELETE http://localhost:3000/orders/workflow/df3c...
```

---

## Reading the Trace

The Zipkin trace for `POST /orders/workflow` is dramatically flatter
than the choreography version:

```text
▼ CallLocal /orders/workflow (order-service)                   ~200ms
    ▼ workflow.orderSagaWorkflow (order-service)
        ▼ CallLocal /payments (payment-service)                ~30ms
        ▼ CallLocal /inventory/reserve (inventory-service)     ~40ms
        ▼ CallLocal /notifications/send (notification-service) ~25ms
```

No pubsub hops, no "what happened after that publish", no re-entrant
subscriber spans. Every step is a plain Service Invocation, and the
orchestrator is a single visible span.

---

## Compensations (out of scope, but the key idea)

If inventory-service throws, the saga is in an inconsistent state:
we already charged the customer. In a compensating saga:

```ts
try {
  const payment = yield ctx.callActivity(processPaymentActivity, orderCreated);
  try {
    const reservation = yield ctx.callActivity(reserveInventoryActivity, payment);
    // ...
  } catch (invErr) {
    yield ctx.callActivity(refundPaymentActivity, payment);
    throw invErr;
  }
} catch (payErr) { ... }
```

Each successful step registers a compensating activity that runs if
a later step fails. Dapr guarantees each compensation runs exactly
once — that's the payoff for using workflows over hand-rolled sagas.

---

## Choreography vs Orchestration — Decision Matrix

| Situation                                    | Prefer            |
| -------------------------------------------- | ----------------- |
| Simple linear pipeline, few consumers        | Choreography      |
| You want independent teams to add subscribers| Choreography      |
| Long-running (>seconds), needs status queries| Orchestration     |
| Branching / parallel fan-out with join        | Orchestration     |
| Timers, external events, human approvals     | Orchestration     |
| Compensating transactions                     | Orchestration     |
| High-throughput event fan-out                 | Choreography      |
| You need to answer "where is order X now?"    | Orchestration     |

**Neither is universally better.** This project now demonstrates both
side-by-side, using the same downstream services. Real systems mix
them: choreography for eventing and notifications, orchestration for
core business sagas.

---

## Interview Angles

**Q. Why must workflows be deterministic?**

Because Dapr uses "event sourcing" replay. Every time the workflow
process wakes to handle an activity's result, it re-runs the workflow
function from the top, using the recorded activity results as a
cache. Non-deterministic code (random, clock, HTTP) would produce
different values on replay, corrupting the history.

**Q. What's the actor connection?**

Every workflow instance is backed by a Dapr Actor. Actors give you
single-threaded execution per instance (no concurrency inside one
instance), automatic placement across nodes, and persistent state.
Workflows layer a durable-execution API on top.

**Q. What does `actorStateStore: true` do?**

It marks a state store as usable as the actor backing store. Only one
component per app can be flagged. Without it, `WorkflowRuntime.start()`
fails at startup.

**Q. How does the workflow survive process restarts?**

Every yield checkpoints the workflow's history to the actor state
store. On restart, Dapr detects unfinished workflows and resumes
them by re-running the function and fast-forwarding through recorded
history until the pending yield.

**Q. What if two order-service replicas both try to run the same workflow?**

They can't. The workflow is bound to an actor, and actors are
single-instance per ID across the cluster (enforced by the Placement
service). Whichever replica hosts the actor wins; the other becomes
a client.

---

## Known Limitations of This Lesson

1. **No compensations.** If inventory-reserve throws, payment is not
   refunded. Add a try/catch with compensating activities as shown
   above.
2. **Duplicate business writes possible on retry.** Activities are
   idempotent-by-convention; make the downstream services check for
   duplicate orderIds if you care.
3. **The choreography flow still exists.** `POST /orders` still runs
   the outbox-based version. That's intentional — you can compare both
   in Zipkin side by side.
4. **Only order-service hosts a workflow runtime.** In production
   you'd typically dedicate a service to workflow hosting so it can
   scale independently.

---

## Recap

- New `workflowstore` component with `actorStateStore: true`
- Direct HTTP endpoints on inventory and notification services
- Workflow module in order-service with runtime, client, three
  activities, one saga, one REST controller
- `POST /orders/workflow` starts a saga instance, `GET` polls it,
  `DELETE` terminates it
- Compared choreography vs orchestration; both patterns now
  coexist in this project
