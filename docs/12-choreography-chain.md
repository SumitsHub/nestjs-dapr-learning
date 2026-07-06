# Lesson 12 - Choreography Chain (4-Service Saga)

## Goal

Complete the full event chain across four services using Dapr Pub/Sub:

```text
Order → Payment → Inventory → Notification
```

Each service owns its data, publishes its own business event, and never
knows who consumes it. This is **event choreography** — the opposite of
central orchestration.

---

## Final Flow

```text
Client
  │
  ▼ POST /orders
Order Service
  │
  ├── save Order              (orderstore)
  └── publish OrderCreated ───────────────┐
                                          ▼
                                 Payment Service
                                          │
                                          ├── save Payment  (paymentstore)
                                          └── publish PaymentCompleted ─┐
                                                                        ▼
                                                             Inventory Service
                                                                        │
                                                                        ├── save Reservation (inventorystore)
                                                                        └── publish InventoryReserved ─┐
                                                                                                       ▼
                                                                                          Notification Service
                                                                                                       │
                                                                                                       ├── send Email + SMS
                                                                                                       └── publish NotificationSent
```

---

## Events (all in `libs/common/src/events/`)

| Event                    | Published by         | Consumed by          |
| ------------------------ | -------------------- | -------------------- |
| `OrderCreatedEvent`      | order-service        | payment-service      |
| `PaymentCompletedEvent`  | payment-service      | inventory-service    |
| `InventoryReservedEvent` | inventory-service    | notification-service |
| `NotificationSentEvent`  | notification-service | (none yet)           |

**Rule reinforced:** every cross-service contract lives in `libs/common`.
Nothing under `apps/*` should be imported by another `apps/*` service.

---

## Subscribing to a Topic (recap)

Each subscriber exposes a `/dapr/subscribe` endpoint:

```ts
@Get('/dapr/subscribe')
subscribe() {
  return [
    {
      pubsubname: 'pubsub',
      topic: TOPICS.PAYMENT_COMPLETED,
      route: 'inventory/payment-completed',
    },
  ];
}
```

On startup, the Dapr sidecar calls this endpoint and registers the
subscription against the broker. Nothing else is required.

---

## Payload Propagation — Why `items` Must Flow Through

`OrderCreatedEvent` carries `items: InventoryItemDto[]`. Every downstream
event that eventually reaches Inventory must preserve those items,
otherwise the reservation runs against `undefined`.

Chain:

```text
OrderCreated.items
   │
   ▼
PaymentCompleted.items       ← must be copied through, not dropped
   │
   ▼
InventoryReserved.items
```

**Bug that was fixed in this lesson:** `payment-service` used to
construct `PaymentCompletedEvent` inline without `items`. TypeScript
did not catch it because `PubSubService.publish(topic, data)` types
`data` as `string | object | undefined`.

Two-part fix:

1. Add `items` to `PaymentDto` and propagate in `processPayment`.
2. Assign the publish payload to a typed variable before publishing:

   ```ts
   const paymentCompleted: PaymentCompletedEvent = { ... };
   await this.pubSubService.publish(TOPICS.PAYMENT_COMPLETED, paymentCompleted);
   ```

   Now any future missing field is a compile-time error.

**Follow-up idea:** make `PubSubService.publish` generic:

```ts
async publish<T>(topic: string, data: T): Promise<void>
```

and call it as `publish<PaymentCompletedEvent>(...)`. Then the type is
enforced without a temporary variable.

---

## Running the Full Chain

Start the broker and Mongo:

```bash
cd infra && docker compose up -d
```

Open four terminals and run the four sidecars:

```bash
dapr run --app-id order-service        --app-port 3000 --dapr-http-port 3500 --resources-path ./dapr/components -- yarn nest start order-service
dapr run --app-id payment-service      --app-port 3001 --dapr-http-port 3501 --resources-path ./dapr/components -- yarn nest start payment-service
dapr run --app-id inventory-service    --app-port 3002 --dapr-http-port 3502 --resources-path ./dapr/components -- yarn nest start inventory-service
dapr run --app-id notification-service --app-port 3003 --dapr-http-port 3503 --resources-path ./dapr/components -- yarn nest start notification-service
```

Trigger the chain:

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ORD-777","amount":250}'
```

Expected console output (across the four terminals, in order):

```text
order-service        : published OrderCreated
payment-service      : Received OrderCreated → published PaymentCompleted
inventory-service    : Received PaymentCompleted → published InventoryReserved
notification-service : Received InventoryReserved → EMAIL SENT, SMS SENT → published NotificationSent
```

Mongo collections that should have one new document each:

- `orders`
- `payments`
- `inventory`

---

## Choreography vs Orchestration (interview angle)

| Aspect            | Choreography (this lesson)         | Orchestration (Lesson 15 - Workflows) |
| ----------------- | ---------------------------------- | ------------------------------------- |
| Coordinator       | None. Each service reacts to events. | Central workflow instance             |
| Coupling          | Low                                | Higher (workflow knows every step)    |
| Visibility        | Hard — flow is implicit            | Easy — one place to read the saga     |
| Failure handling  | Each service handles its own retries | Compensations defined per step      |
| Best for          | Simple linear flows, event fan-out | Complex sagas, branching, timeouts    |

**Rule of thumb:** start with choreography, switch to orchestration when
you can no longer answer *"what step is order X on right now?"* by
grepping logs.

---

## Known Latent Issues (deferred, will be fixed in later lessons)

1. **Dual-write in `order-service`** — save-to-Mongo and publish-event
   are two calls. A crash between them loses the event. To be fixed in
   the **Transactional Outbox** lesson.
2. **Hardcoded Dapr port** — `PubSubService` uses port 3500 (order's
   sidecar) for every service. Works only on localhost. Should read
   `process.env.DAPR_HTTP_PORT`. To be fixed alongside observability.
3. **No subscriber-side retry / dead letter topic** — a permanent
   error in `payment-service` currently just logs and dies. To be fixed
   in the **Pub/Sub Reliability** lesson.

---

## Recap

- Four-service saga running end-to-end
- Contracts consolidated in `libs/common` (no cross-service leakage)
- Field-drift bug caught and hardened against
- Two follow-up lessons queued: Observability, Pub/Sub reliability + DLQ,
  then Transactional Outbox
