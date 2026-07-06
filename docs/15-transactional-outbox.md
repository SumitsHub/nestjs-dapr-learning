# Lesson 15 - Transactional Outbox

## Goal

Eliminate the last real correctness bug in `order-service`: the
dual-write between "save to state store" and "publish OrderCreated".
Make both happen atomically, so no crash between them can lose the
event.

---

## The Dual-Write Problem (recap)

Before this lesson, `createOrder()` did:

```ts
await stateService.saveOrder(order);          // (1) Mongo write
await pubSubService.publish(TOPICS.ORDER_CREATED, event);  // (2) RabbitMQ publish
```

Two separate operations. Four possible outcomes:

| (1) Save   | (2) Publish | Result                                  |
| ---------- | ----------- | --------------------------------------- |
| ✅ success | ✅ success  | Happy path                              |
| ❌ fail    | (not run)   | No order, no event — safe               |
| ✅ success | ❌ fail     | **Order exists, event lost forever**    |
| ✅ success | (crash)     | **Same as above — silent inconsistency**|

Row 3 and 4 are the killers. Once an order is saved but the event was
never emitted, payment/inventory/notification never fire — and no
alerting will catch it because the HTTP response was 200.

Common workarounds people try:

- **Publish first, then save** → same problem, just reversed.
- **Try/catch and retry the publish** → helps a little, but a process
  crash mid-retry still loses the event.
- **Wrap in a distributed transaction (2PC/XA)** → historically
  fragile, banned by most brokers.

The industry-standard fix is the **Outbox Pattern**.

---

## What Outbox Actually Does

Classical implementation:

```text
BEGIN TX
  INSERT INTO orders (...)
  INSERT INTO outbox_events (topic, payload)
COMMIT

──── separate poller ────
SELECT * FROM outbox_events WHERE NOT PUBLISHED
publish -> broker
mark PUBLISHED
```

Two writes to the **same database** in one transaction. Since the
broker is decoupled, the app never talks to it directly. A poller (or
change-data-capture stream) reads the outbox and publishes.

Failure modes reduce to:

- Crash before COMMIT → nothing happened, retry safely.
- Crash after COMMIT, before poller runs → poller catches up on
  restart. **Event is never lost, only sometimes delayed.**
- Poller crashes → resumes from where it left off.

Trade-off: events can be **published more than once** (poller
re-publishes a row it thought failed). Consumers must be idempotent.
This is at-least-once delivery — the standard messaging guarantee.

---

## Dapr's Built-In Outbox

Dapr collapses the entire pattern into **component metadata**. No
poller code, no outbox table. Enable it on any transactional state
store:

`dapr/components/orderstore.yaml`:

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: orderstore
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: 'localhost:6379'
    - name: outboxPublishPubsub
      value: 'pubsub'
    - name: outboxPublishTopic
      value: 'order-created'
    - name: outboxPubsub
      value: 'pubsub'
    - name: outboxDiscardWhenMissingState
      value: 'true'
```

Meaning:

- Every `state.save()` on `orderstore` writes state AND publishes to
  `pubsub` / topic `order-created` in one atomic step.
- The published payload is **the stored value itself**, verbatim.
- The application code shrinks from two calls to one.

`apps/order-service/src/order-service.service.ts`:

```ts
async createOrder(payload: CreateOrderDto) {
  const order: OrderCreatedEvent = {
    orderId: payload.orderId,
    amount: payload.amount,
    status: OrderStatus.CREATED,
    createdAt: new Date(),
    items: [{ sku: 'SKU-123', quantity: 2 }],
  };

  await this.stateService.saveOrder(order);   // ← the ONLY call
  return { orderCreated: true, eventPublished: true };
}
```

Notice: `PubSubService.publish(TOPICS.ORDER_CREATED, ...)` is gone.
It's removed from the module's providers too.

---

## The Subtle Trap — Save vs Transaction

Dapr's outbox is hooked into the state store's **transactional**
endpoint, not the plain bulk-save one:

| SDK call                        | HTTP endpoint                          | Outbox fires? |
| ------------------------------- | -------------------------------------- | ------------- |
| `client.state.save(...)`        | `POST /v1.0/state/{store}`             | ❌ No         |
| `client.state.transaction(...)` | `POST /v1.0/state/{store}/transaction` | ✅ Yes        |

If you use `.save()`, the state is written and everything looks fine
— but no event is ever published. Very easy to miss, because the
Redis key gets updated correctly. The tell-tale sign in the sidecar
log is that the outbox topic subscription exists at startup
(`defaultorder-serviceorder-createdoutbox`) but you never see a
publish event go through it.

Correct usage in [state.service.ts](../apps/order-service/src/state.service.ts):

```ts
await this.client.state.transaction('orderstore', [
  {
    operation: 'upsert',
    request: { key: order.orderId, value: order },
  },
]);
```

For a single-key upsert, the transaction has exactly one operation.
For a real business transaction (e.g. save order + save invoice
atomically), you'd pass multiple operations in the same array — and
both would be part of the same outbox event batch.

---

## Why Redis, Not Mongo, for `orderstore`

Outbox requires the state store to support transactions (state write
+ outbox-topic write must commit together).

- **Redis:** transactions via MULTI/EXEC. Works out of the box.
- **MongoDB:** requires a replica set for multi-document transactions.
  A single-node Mongo container does not qualify.

Rather than reconfigure `docker-compose` to init a single-node
replica set (`--replSet rs0` + `rs.initiate()` bootstrap), we added
Redis and pointed *only* `orderstore` at it. `paymentstore`,
`inventorystore`, and `secretstore` still use Mongo.

This is realistic: production systems routinely mix stores — a fast
key-value store for hot paths that need atomicity, a document store
for rich querying. Dapr makes this a per-component choice.

If you *do* want Mongo-backed outbox, run Mongo like this:

```yaml
mongodb:
  image: mongo:8
  command: ['--replSet', 'rs0', '--bind_ip_all']
  ports: ['27017:27017']
  healthcheck:
    test: |
      mongosh --quiet --eval "try { rs.status() } catch (_) {
        rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})
      }"
    interval: 5s
    retries: 20
```

and use `?replicaSet=rs0` in the connection string.

---

## Proving It Works — the Chaos Endpoint

`POST /orders/chaos` calls `createOrder()` and then throws:

```ts
@Post('chaos')
async chaos(@Body() body: CreateOrderDto) {
  await this.orderService.createOrder(body);
  throw new HttpException('Simulated crash AFTER save', 500);
}
```

**Before Lesson 15** (dual-write): the client receives 500, the order
exists in the DB, but the event was still en route to `publish()`
which now doesn't run. The chain never fires.

**After Lesson 15** (outbox): the client still receives 500, but the
sidecar has *already* committed both the state and the outbox topic
in one atomic step before `saveOrder()` even returned. Payment,
inventory, and notification all fire.

Test it:

```bash
curl -X POST http://localhost:3000/orders/chaos \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ORD-CHAOS-1","amount":42}'
```

Expected:

- HTTP 500 response body: `"Simulated crash AFTER save..."`
- `payment-service` logs: `Received OrderCreated event`
- `inventory-service` logs: `Received PaymentCompleted`
- `notification-service` logs: `EMAIL SENT`, `SMS SENT`
- Redis: `redis-cli GET orderstore\|\|ORD-CHAOS-1` returns the order

---

## Reading the Trace in Zipkin

The chaos request produces one trace with a slightly different shape:

```text
▼ CallLocal /orders/chaos (order-service)                  40 ms   ← ends with 500
    ▼ StateSaveTx orderstore + outboxPublish order-created  ~5 ms
        ▼ PublishEvent order-created (via outbox)           ~3 ms
            ▼ CallLocal /orders/order-created (payment-service) ...
```

The top-level span is red (error status from the 500), but every
child span is green. That single picture is the entire point of the
outbox pattern: **the failure of the HTTP handler is completely
decoupled from the reliability of downstream events.**

---

## At-Least-Once, Not Exactly-Once

The outbox pattern gives you at-least-once delivery. Consumers may
see the same event twice under two conditions:

1. The poller (or in Dapr's case, the internal outbox forwarder)
   crashes after publishing but before marking the row done.
2. A subscriber returns 5xx and Dapr redelivers.

**Mitigation is entirely on the consumer:** every subscriber should
be idempotent. Store a dedupe key (usually `event.id` from the
CloudEvent) in state before doing side effects.

We haven't done this yet — payment-service happily double-processes.
That's the natural setup for the next lesson.

---

## Interview Angles

**Q. What are the alternatives to the outbox pattern?**

- **Change Data Capture (CDC)** — e.g. Debezium tailing the WAL/oplog
  and streaming inserts to Kafka. Cleaner separation but needs a
  dedicated pipeline.
- **Event sourcing** — the events *are* the source of truth; state is
  a projection. Powerful but heavy.
- **Two-phase commit (2PC)** — historically brittle, most brokers
  don't support it, avoid.

**Q. Doesn't the outbox add latency?**

Yes — a small one (state write must serialize with the outbox
publish). In practice it's dominated by the state store's transaction
cost. Trade a few ms for zero lost events.

**Q. Why is exactly-once impossible in general?**

Because acknowledgements can be lost. If a publisher sends, waits
for ack, and the ack is dropped, it has no way to know whether the
broker actually received the message — so it retries, and now there
are two. This is why consumers must be idempotent.

**Q. Where does Dapr store the outbox table?**

Inside the same state store as the data. For Redis it uses a
dedicated key namespace; for SQL stores it uses a companion table.
You don't manage the table yourself.

---

## Known Latent Issues Still Open

1. **Consumer idempotency** — payment-service will double-process on
   redelivery. → *Next lesson: Idempotent consumers with dedupe key.*
2. **Order projection currently equals the event contract.** If they
   ever diverge (e.g. `OrderCreatedEvent` needs a computed field
   the stored order doesn't have), you'd use Dapr's outbox
   projection metadata to override the published payload without
   changing the stored value.
3. **The `PubSubService.publish` code path is still used by
   payment/inventory/notification services.** Only order-service has
   moved to outbox. Extending outbox everywhere is a separate refactor
   (`paymentstore` and `inventorystore` would need Redis, or Mongo RS).

---

## Recap

- Dual-write eliminated in `order-service`
- Enabled Dapr's built-in outbox via 4 lines of YAML on `orderstore`
- Swapped orderstore's backing store to Redis (transactions required)
- One less service call in the application layer
- Proven with a chaos endpoint that crashes AFTER save and still
  fires the full downstream chain
- Consumer idempotency deferred to next lesson
