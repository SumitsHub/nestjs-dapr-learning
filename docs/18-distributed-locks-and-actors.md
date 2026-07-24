# Lesson 18 - Distributed Locks (and how Actors compare)

## Goal

Fix a real race condition in `inventory-service`: two concurrent
reservations for the same SKU shouldn't both succeed if only one
unit is left. Introduce Dapr's **Distributed Lock** building block,
then compare with the **Actors** building block, which solves the
same class of problem differently.

---

## The Race Nobody Was Watching

Until now, `POST /inventory/reserve` was fabricating a reservation
UUID and returning it — no stock check, no decrement, no persistence
of "how many are left". Reality caught up: we need per-SKU counters.

Naive first pass:

```ts
const current = await stateStore.get('stock:SKU-123');   // read
const next    = current - requested;                     // compute
if (next < 0) throw 'insufficient stock';
await stateStore.save('stock:SKU-123', next);            // write
```

This is a classic **check-then-act race**. Two concurrent requests
can both read `current = 3`, both compute `next = 3 - 2 = 1`, both
write `1`. Four units reserved, one remains. Two customers happy,
one warehouse manager not.

The database doesn't help — MongoDB single-doc writes are atomic,
but the *check-then-write across two calls* isn't. You need
serialization across the whole read-decide-write sequence.

Two idiomatic Dapr answers:

1. **Distributed Lock building block** — this lesson.
2. **Actors building block** — covered further down.

---

## Distributed Lock

Dapr Distributed Lock is a small, focused API:

```ts
await client.lock.lock(store, resourceId, lockOwner, expiryInSeconds);
await client.lock.unlock(store, resourceId, lockOwner);
```

Semantics:

- **`resourceId`** — the thing being protected. We use `stock:SKU-123`.
- **`lockOwner`** — who's holding the lock. Must be unique per
  process/instance so one replica can't accidentally release
  another replica's lock. Random UUID per boot works.
- **`expiryInSeconds`** — the lease. If the holder dies without
  unlocking, the lock is auto-released after this many seconds.
  This is *essential* — a crashed holder must not block the
  resource forever.

The `lock()` call returns `{ success: true }` if acquired,
`{ success: false }` if someone else holds it. **It does not
block.** No queueing, no waiting — you decide what to do on
contention.

That non-blocking behaviour bites hard under real concurrency: fire
5 requests in the same millisecond and 4 of them collide with a lock
held for ~10ms, all seeing `success:false` even though the resource
is about to be free. Our `LockService.withLock` therefore layers a
**bounded retry with exponential backoff + jitter** on top:

- Attempt 1: try immediately.
- On `success:false`: sleep `base × 2^(n-1) × (0.5..1.5)` and retry.
- Defaults: 6 attempts, 20ms base → ~1.3s worst case.
- After max attempts: throw `LockUnavailableError`.

This is the industry-standard pattern — Redlock, `pg_advisory_lock`
wrappers, and Java `Redisson` all layer retry over the raw acquire.
Callers that want fail-fast semantics (e.g. a UI showing "someone
else is editing") pass `maxAttempts: 1`.

### Component

`dapr/components/lockstore.yaml`:

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: lockstore
spec:
  type: lock.redis
  version: v1
  metadata:
    - name: redisHost
      value: 'localhost:6379'
```

Redis is a natural fit — its single-threaded execution model gives
`SETNX` (set-if-not-exists) as an atomic primitive, which is exactly
what a lock needs.

### Wrapping the critical section

`libs/dapr-core/src/lock.service.ts` (excerpt):

```ts
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const acquired = await client.lock.lock(store, resourceId, owner, ttl);
  if (acquired.success) {
    try { return await fn(); }
    finally { await client.lock.unlock(store, resourceId, owner); }
  }
  if (attempt === maxAttempts) break;
  await sleep(baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random()));
}
throw new LockUnavailableError(resourceId);
```

And the reserve service loops per SKU:

```ts
for (const item of payload.items ?? []) {
  await this.lockService.withLock(`stock:${item.sku}`, async () => {
    const current = await this.stateService.getStock(item.sku);
    if (current < item.quantity) {
      throw new InsufficientStockError(item.sku, item.quantity, current);
    }
    await this.stateService.setStock(item.sku, current - item.quantity);
  });
}
```

Note the lock is **per-SKU**, not global. Two concurrent reservations
for *different* SKUs run in parallel. Only same-SKU contention
serializes.

---

## Proving It Works

Seed 3 units:

```bash
curl -X POST http://localhost:3002/inventory/stock/SKU-DEMO \
  -H 'Content-Type: application/json' -d '{"quantity":3}'
```

Fire 5 concurrent reservations for 1 unit each:

```bash
for i in 1 2 3 4 5; do
  curl -s -w "%{http_code}\n" -X POST http://localhost:3002/inventory/reserve \
    -H 'Content-Type: application/json' \
    -d "{\"paymentId\":\"c-$i\",\"orderId\":\"c-$i\",\"amount\":1,
        \"status\":\"COMPLETED\",\"processedAt\":\"2026-07-23T00:00:00Z\",
        \"items\":[{\"sku\":\"SKU-DEMO\",\"quantity\":1}]}" &
done; wait
```

Expected: exactly **three** `200`s and **two** `409 Conflict`s.
Stock ends at `0`, not negative.

Delete the `withLock` wrapper and rerun to see the race in action —
stock may end at `-2`.

---

## Failure Modes You Must Understand

### The holder crashes with the lock held

Without a TTL, the resource is blocked forever. That's why
`expiryInSeconds` is mandatory. Pick a value that comfortably
exceeds your worst-case critical-section duration.

### The critical section is slower than the TTL

Bad. Your lock silently expires, another holder acquires it, and
now two holders think they own the resource. This is the
"stale-lock" problem and it's the reason true "always-safe" locking
is [famously hard](https://martin.kleppmann.com/2016/02/08/how-to-do-locking.html).

Mitigations:

- Keep critical sections short and predictable.
- Set TTL 3-5× your P99 duration.
- Use *fencing tokens* if your protected resource supports them —
  Dapr locks don't provide these out of the box, so you must
  design the downstream write to be idempotent per intended change.

### Network partitions

Dapr Lock is not consensus-based (no Raft/Paxos). If the Redis
node hosting the lock is on the wrong side of a partition, two
holders can briefly coexist. For a payment or inventory system,
combine locks with defensive checks (e.g., check-then-CAS on the
data itself). For life-safety systems, use a stronger primitive
(etcd / ZooKeeper).

---

## Actors — the Same Problem, Different Answer

Dapr Actors solve concurrency by **assigning ownership**, not by
locking. Each actor instance is:

- Single-threaded per ID across the cluster (Placement service
  enforces this).
- Stateful — its state lives in an `actorStateStore` (we already
  have one from Lesson 17: `workflowstore`).
- Automatically activated / passivated based on traffic.

The inventory-per-SKU problem maps naturally:

```
ActorType: InventoryItem
ActorId:   SKU-123
State:     { quantity: number }
Methods:   initialize(qty), reserve(qty), getStock()
```

Every reservation for SKU-123 goes to *the one InventoryItem actor
for SKU-123*. No lock needed — the actor's turn-based concurrency
serializes calls automatically.

### Why we didn't implement it here

Node.js Dapr Actors require the `DaprServer` class from `@dapr/dapr`,
which runs its own HTTP server. Composing that with Nest's server
(both trying to be the `--app-port` target) is awkward. Real
production TypeScript projects usually solve this by:

1. Dedicating a standalone Node process (a fifth microservice) that
   hosts only the actor runtime; other services invoke it via
   `ActorProxyBuilder`.
2. Or implementing the actor HTTP protocol manually in a Nest
   controller — feasible but boilerplate-heavy.

Both are legitimate; we skipped the ceremony because the same
learning outcome is available via the lock building block, which is
simpler and demonstrates the concept concretely.

### Decision matrix — Lock vs Actor

| Situation                                       | Prefer  |
| ----------------------------------------------- | ------- |
| Short critical section, existing service        | Lock    |
| Stateful entity with many concurrent operations | Actor   |
| Need timers / reminders on the state            | Actor   |
| Need to serialize access to an external resource| Lock    |
| Hot spot: one entity, thousands of ops/second   | Actor   |
| Simple, occasional coordination                 | Lock    |
| You already run the JS SDK's `DaprServer`       | Actor   |
| Nest / Express / Fastify app                    | Lock    |

Both are legitimate. Netflix's inventory service famously moved from
a distributed-lock-based design to an actor-based design when the
hot-SKU contention overwhelmed the lock store. That's the axis you
care about at scale.

---

## Interview Angles

**Q. Why is `expiryInSeconds` mandatory on a distributed lock?**

Without a lease, a holder that crashes leaves the resource
permanently blocked. The TTL is the only automatic recovery from
holder failure. Every distributed lock system has this — Redlock,
Consul, ZooKeeper (via ephemeral nodes), etcd (via leases).

**Q. What's a fencing token and why don't we have one?**

A monotonically-increasing number issued with each lock acquisition.
The protected resource rejects writes with an older token, so a
stale holder's late write can't corrupt state. Dapr locks don't
expose one directly; you'd bolt one on via an ETag on the underlying
state write (which we don't — we trust the TTL).

**Q. Redis is single-threaded. Why do I need a lock at all?**

Because your *application code* isn't. The race we fixed was
"read from Redis in service A, compute, write to Redis from service
A". Redis serving those two ops is fine; A's two concurrent handlers
racing between them isn't. The lock serializes the composite.

**Q. When would you pick Actors over Distributed Lock?**

When the protected thing is (a) an addressable entity, (b) touched
constantly by many callers, and (c) stateful. Actors give you
serialization + colocated state + automatic placement. Locks are
better for occasional cross-service coordination on things that
aren't naturally an entity (e.g., "only one cron worker runs the
5-minute rollup").

**Q. What's the failure mode you fear most for the lock design?**

Critical-section duration approaching or exceeding the TTL. The lock
silently expires, a second holder acquires it, both write. Prevention:
short critical sections + TTL well above P99 + idempotent downstream
writes.

---

## Known Limitations of This Lesson

1. **No fencing token** — a slow critical section that exceeds
   the TTL could produce inconsistent writes.
2. **Reservation still uses `randomUUID`** — the demo doesn't tie
   the reservation record to the stock decrement transactionally.
   In a real system you'd want both in one Redis MULTI or in a
   single state-store transaction.
3. **Actor path not implemented** — described only. Adding it in
   Node with Nest requires either a standalone actor host or manual
   HTTP protocol implementation; both are non-trivial.
4. **Lock building block is Alpha** — API stable enough for this
   project but check current status before production use.

---

## Recap

- New `lockstore` component (`lock.redis`).
- `inventory-service` now persists per-SKU stock in `inventorystore`
  and decrements it under a per-SKU distributed lock in the
  `/inventory/reserve` endpoint.
- Concurrent same-SKU reservations correctly serialize; different
  SKUs still run in parallel.
- Documented the Actor alternative, decision matrix, and lock
  failure modes.
