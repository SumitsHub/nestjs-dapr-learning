# Lesson 16 - Idempotent Consumers

## Goal

Make every subscriber safe under **at-least-once delivery**. The
outbox from Lesson 15 and the retry policy from Lesson 14 both mean
the same event can arrive more than once. Without a guard, this
causes duplicate payments, double inventory reservations, and
repeated notifications.

---

## Why Duplicates Happen (recap)

Three separate mechanisms can redeliver the same event:

1. **Outbox forwarder** re-publishes after a crash between publish
   and mark-published. → Lesson 15
2. **RabbitMQ + Dapr retry policy** redelivers when the handler
   returns non-2xx. → Lesson 14
3. **Broker Nack on crash** — if the subscriber acks with a business
   success but crashes before its own follow-up work commits.

All three collapse into the same problem: *you will see the same
CloudEvent id twice*. Fix once, protect everywhere.

---

## The Dedupe Key

Every message Dapr publishes carries a CloudEvent envelope:

```json
{
  "specversion": "1.0",
  "id": "af1c7d2e-...",
  "source": "order-service",
  "type": "com.dapr.event.sent",
  "data": { ... }
}
```

**`id` is stable across redeliveries** — it's assigned once by the
sidecar at publish time. That makes it the natural dedupe key.

If you're deliberately republishing a *logically new* copy of an
event, use a fresh `id`. If Dapr is retrying because of a failure,
the `id` stays the same.

---

## The Guard

New shared service in `libs/dapr-core`:

```ts
@Injectable()
export class IdempotencyService {
  async wasProcessed(eventId: string): Promise<boolean>;
  async markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
}
```

Backed by a new Dapr component:

```yaml
# dapr/components/dedupstore.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: dedupstore
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: 'localhost:6379'
    - name: ttlInSeconds
      value: '604800'      # 7 days
```

Every subscriber now looks like:

```ts
@Post('/orders/order-created')
async handleOrderCreated(@Body() event: CloudEvent<OrderCreatedEvent>) {
  if (await this.idempotency.wasProcessed(event.id)) {
    console.log(`[idempotency] skipping duplicate eventId=${event.id}`);
    return { success: true };
  }

  // ... normal business logic ...

  await this.idempotency.markProcessed(event.id);
  return { success: true };
}
```

Three lines at the top, one line at the bottom. Applied to:

- payment-service — `handleOrderCreated`, `handleDeadLetter` (with a
  `dlq:` prefix on the key so the DLQ handler doesn't collide with
  its own main-topic subscription)
- inventory-service — `handlePaymentCompleted`
- notification-service — `handleInventoryReserved`

---

## The Race Window (be honest about it)

The check happens **before** the business write; the mark happens
**after**. If the process crashes between them, the next redelivery
will re-process. Timeline of what can go wrong:

```text
receive event id=X
  ├── wasProcessed(X) → false
  ├── save payment (Mongo commit)   ✅
  ├── publish PaymentCompleted       ✅
  ├── [PROCESS CRASHES]
       (markProcessed never runs)
receive event id=X (redelivery)
  ├── wasProcessed(X) → false        ← still false
  └── DUPLICATE payment saved
```

This makes our implementation **at-least-once processing** — same
delivery guarantee, one level up the stack. For most business
domains (payments, notifications, inventory reservations) this is
fine as long as duplicates are rare and detectable downstream. The
guard catches the *common* case: fast broker redelivery within
milliseconds.

### Getting to exactly-once processing

Include the mark in the **same transaction** as the business write:

```ts
await client.state.transaction('paymentstore', [
  { operation: 'upsert', request: { key: payment.paymentId, value: payment } },
  { operation: 'upsert', request: { key: `dedup:${event.id}`, value: {} } },
]);
```

Then even a crash between the two operations can't leave dedup and
business state inconsistent — both commit or neither does.

This requires the payment/inventory stores to be transactional
(Redis, or Mongo replica set). That refactor is deferred; the current
setup is a pragmatic compromise.

---

## Testing the Guard

Publish the same CloudEvent id twice directly through the sidecar's
publish endpoint (bypassing order-service so we can control the id):

```bash
curl -X POST http://localhost:3500/v1.0/publish/pubsub/order-created \
  -H 'Content-Type: application/cloudevents+json' \
  -d '{
    "specversion":"1.0",
    "id":"evt-fixed-idempotency-1",
    "source":"manual-test",
    "type":"com.dapr.event.sent",
    "datacontenttype":"application/json",
    "data":{
      "orderId":"ORD-DUP-1","amount":111,"status":"CREATED",
      "createdAt":"2026-07-06T12:00:00Z",
      "items":[{"sku":"SKU-DUP","quantity":1}]
    }
  }'
```

Run it twice with the same `id`. Expected in `payment-service`:

```text
first  : Received OrderCreated event ... Published PaymentCompleted event
second : [idempotency] skipping duplicate order-created eventId=evt-fixed-idempotency-1
```

Inventory and notification also skip on the second run because
their subscriptions see the fanned-out downstream events keyed by
*their own* CloudEvent ids (which change on republish only if the
publisher generates new ones). In our chain, the first publish
produces one `PaymentCompleted` event with a fresh id; the second
publish is skipped so no new `PaymentCompleted` is emitted at all.

Ready-to-run version in
[tests/rest-client/order-service.http](../tests/rest-client/order-service.http)
under *"Idempotency (Lesson 16)"*.

### Inspecting the Dedup Keys

Dapr keys are prefixed with the **app ID**, not the store name:

```bash
docker exec dapr_redis redis-cli KEYS '*dedup:*'                 # all consumer dedup keys
docker exec dapr_redis redis-cli KEYS 'payment-service||dedup:*' # payment-service only
```

`KEYS 'dedupstore*'` returns nothing — that's the Dapr *component*
name, not the Redis key prefix.

See the "Which Redis?" note in
[docs/15-transactional-outbox.md](./15-transactional-outbox.md#which-redis)
if you're unsure which container holds the data.

---

## Interview Angles

**Q. Why not use `orderId` as the dedupe key?**

Because `orderId` is a domain identifier. Two separate business
events about the same order (e.g. `OrderCreated` and `OrderCancelled`)
would collide. The CloudEvent `id` is the transport identifier —
unique per publish, stable per delivery. That's what dedup wants.

**Q. What's the difference between at-least-once delivery and
at-least-once processing?**

- *Delivery* is the broker's guarantee: the message will arrive at
  least once.
- *Processing* is the consumer's guarantee: side effects happen at
  least once.

A dedupe guard converts at-least-once *delivery* into at-least-once
*processing* with the race window described above. Full exactly-once
processing requires transactional dedup.

**Q. Why 7-day TTL?**

Longer than any reasonable broker retention window. If a message
reappears after 7 days it will be re-processed — accepted trade-off
for keeping the dedup store bounded.

**Q. Alternatives to CloudEvent id?**

- **Content hash** — hash the payload. Handy when you're integrating
  with a source that doesn't provide stable ids. Downside: two
  logically-different events with identical payloads collide.
- **Business dedupe** — e.g. "one payment per orderId ever". Encoded
  in the domain, doesn't need a separate store. Best when the domain
  permits it; use in addition to event-id dedup for defense in depth.

---

## Recap

- `dedupstore` component added (Redis, 7-day TTL)
- `IdempotencyService` shared across all three subscribers
- Each handler now checks-then-processes-then-marks
- Duplicates from outbox forwarder, retry policy, and broker Nack all
  covered
- Race window documented; exactly-once upgrade path noted
