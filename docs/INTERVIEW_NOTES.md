# Interview Notes

This document captures concepts learned during the project, common interview questions, architectural trade-offs, and production considerations.

---

# What is Dapr?

Dapr (Distributed Application Runtime) is an open-source runtime that provides common distributed system capabilities as reusable building blocks.

Instead of integrating directly with infrastructure such as RabbitMQ, Redis, MongoDB, or service discovery, applications communicate with the local Dapr sidecar.

Benefits:

- Infrastructure abstraction
- Portable applications
- Language agnostic
- Easier migration between providers
- Consistent APIs

---

# Sidecar Pattern

Every application runs with a Dapr sidecar.

```text
Application
      |
localhost
      |
Dapr Sidecar
      |
Infrastructure
```

The application never communicates directly with infrastructure.

Interview Question:

**Why is the Sidecar Pattern useful?**

Answer:

It separates business logic from infrastructure concerns. Applications interact with Dapr using stable APIs while Dapr handles service discovery, retries, messaging, state management, and secrets.

---

# Service Invocation

Purpose:

Synchronous communication between services.

Characteristics:

- Request/Response
- Immediate response required
- Supports retries
- Supports timeout policies
- Supports circuit breakers

Typical use cases:

- Payment processing
- Validation
- Inventory lookup

Interview Question:

**When would you choose Service Invocation over Pub/Sub?**

Answer:

Choose Service Invocation when the caller requires an immediate response or result.

---

# Pub/Sub

Purpose:

Asynchronous communication using events.

Characteristics:

- Loosely coupled
- Event driven
- Publisher does not know subscribers
- Easier horizontal scaling

Typical events:

- Order Created
- Payment Completed
- Inventory Reserved

Interview Question:

**Why didn't retry policies trigger when Payment Service was stopped?**

Answer:

The publisher only communicates with RabbitMQ through Dapr. Since RabbitMQ accepted the message successfully, no failure occurred from the publisher's perspective, so retry policies were never invoked.

---

# State Store

Purpose:

Persist application state without coupling the application to a specific database implementation.

Current backend:

MongoDB

Benefits:

- Infrastructure abstraction
- Easier backend replacement
- Simplified APIs
- Consistent programming model

---

# Secret Store

Purpose:

Store sensitive information outside application code.

Examples:

- Database credentials
- API keys
- Connection strings

Benefits:

- No hardcoded secrets
- Easier rotation
- Environment-specific configuration

---

# Shared Contracts

A NestJS monorepo allows multiple services to share DTOs, events, enums, and interfaces.

Benefits:

- Single source of truth
- Compile-time validation
- Better IDE support
- Easier refactoring
- Reduced integration bugs

Interview Question:

**Why use a monorepo?**

Answer:

Shared libraries reduce duplication and ensure all services compile against the same contracts, preventing many runtime integration issues.

---

# DTO vs Event

DTO:

Represents a request or response.

Examples:

- CreateOrderDto
- CreatePaymentDto

Event:

Represents something that has already happened.

Examples:

- OrderCreatedEvent
- PaymentCompletedEvent

Events should be immutable and describe historical facts.

---

# Current Production Practices

- Shared contracts
- Typed communication
- Event-driven architecture
- Incremental refactoring
- Small Git commits
- Documentation-first approach

---

# Event-Driven Architecture

## Why publish events?

Publishing events removes direct coupling between services.

Instead of:

Order → Payment

we have:

Order → Event Bus → Payment

Benefits

- Loose coupling
- Better scalability
- Easier extensibility
- Independent deployments

---

# CloudEvents

Dapr wraps every published event inside a CloudEvent envelope.

Example

```json
{
  "id": "...",
  "source": "order-service",
  "topic": "order-created",
  "data": {
    "orderId": "ORD-001"
  }
}
```

Subscriber should receive

```ts
CloudEvent<OrderCreatedEvent>;
```

Business services should work with

```ts
OrderCreatedEvent;
```

not the CloudEvent wrapper.

---

# DTO vs Event

DTO

Represents internal application data.

Example

PaymentDto

Event

Represents something that happened.

Example

PaymentCompletedEvent

Never expose internal persistence models directly as integration events.

---

# Shared Libraries

libs/common

Contains

- DTOs
- Events
- Enums
- Constants

No infrastructure.

libs/dapr-core

Contains reusable Dapr infrastructure.

Examples

- PubSubService
- InvocationService

---

# Microservice Data Ownership

Every microservice owns its own database or collection.

Avoid

Shared database tables between services.

Prefer

Order → orders collection

Payment → payments collection

---

# Why use Dapr?

Without Dapr

- RabbitMQ SDK
- MongoDB SDK
- Secret SDK
- Retry logic
- Service Discovery

With Dapr

Services call a consistent API.

Infrastructure becomes pluggable.

Application code remains simple.

---

# Important Interview Questions

Q. Why CloudEvents?

Standard event format across brokers and platforms.

---

Q. Why separate DTOs and Events?

Events are public contracts.

DTOs are internal models.

---

Q. Why separate collections?

Clear ownership.

Independent evolution.

Avoid cross-service coupling.

---

Q. Why shared infrastructure library?

Avoid duplicated infrastructure code.

Keep business services focused on domain logic.

# Topics Remaining

- Retry
- Timeout
- Circuit Breaker
- Distributed Workflows
- Saga Pattern
- Idempotency
- Outbox Pattern
- Multi-Tenancy
- OpenTelemetry
- Distributed Tracing
- Kubernetes
- Scaling Strategies
- Production Deployment
- Monitoring
- Health Checks

These sections will be expanded as the project evolves.

---

# Choreography vs Orchestration

Both are ways to compose a multi-service business flow.

**Choreography** — every service reacts to events on its own. No central
coordinator. Current project: `Order → Payment → Inventory → Notification`
is pure choreography.

**Orchestration** — a workflow instance owns the flow. It decides the
next step, waits for results, and calls compensations on failure. Dapr
Workflows implement this.

Interview Question:

**When would you switch from choreography to orchestration?**

Answer:

- When you can no longer trace the flow by reading a single log.
- When compensations (undo payment, release inventory) become non-trivial.
- When you need branching or human-in-the-loop steps.
- When SLA visibility per business transaction becomes a product requirement.

---

# Field Drift in Event Contracts

If `PubSubService.publish(topic, data: object)` is untyped, a service can
publish an event that is missing required fields and no compiler catches
it. The consumer then reads `undefined` at runtime.

Mitigations (in order of strength):

1. Assign the payload to a typed variable before publishing.
2. Make `publish` generic: `publish<T>(topic, data: T)`.
3. Add a runtime schema validator (Zod / class-validator) at both
   publish and consume boundaries. Required once you cross a language
   boundary or an org boundary.

---

# Distributed Tracing (Lesson 13)

Dapr propagates a W3C `traceparent` header on every Service Invocation
and every Pub/Sub message. Every sidecar exports spans to Zipkin (or
any OpenTelemetry-compatible backend).

Interview Question:

**How does Dapr propagate trace context across Pub/Sub?**

Answer:

Dapr writes `traceparent` into the CloudEvent envelope. The consumer
sidecar reads it back out and continues the trace on the downstream
service. The application code never touches it.

Interview Question:

**Why is `samplingRate: 1` dangerous in production?**

Answer:

It traces 100% of requests. At scale, span storage and network cost
explodes. Typical prod values are 1–10% head-based sampling, plus
100% tail sampling of error traces so failures are always visible.

---

# DaprClient Connection Config

Every service must talk to *its own* sidecar. Hardcoding a port works
in local dev only because all sidecars load the same components. In
production (per-pod sidecars) and in tracing, it silently corrupts
service attribution.

Fix: read `DAPR_HTTP_PORT` (auto-exported by `dapr run`) from the env.
Centralize it in a single factory so it cannot drift.

---

# Pub/Sub Reliability & Dead Letter Topics (Lesson 14)

Two orthogonal knobs:

1. **Retries** — a `Resiliency` policy on the pubsub component's
   `inbound` path bounds how many times a failing message is redelivered.
2. **`deadLetterTopic`** — declared on the subscription itself. After
   retries are exhausted, the runtime forwards the CloudEvent (headers
   intact) to this topic.

Both are required. Without the retry cap, the DLQ never triggers.

Interview Question:

**Why not just rely on RabbitMQ's native dead-lettering (x-dead-letter-exchange)?**

Answer:

It works, but bypasses the Dapr abstraction. You lose portability
(each broker has its own dead-letter syntax) and Dapr features like
`traceparent` propagation into the DLQ handler. Use
`deadLetterTopic` unless you specifically need broker features Dapr
doesn't expose.

Interview Question:

**How would you make a subscriber idempotent?**

Answer:

Use a dedupe key in the state store (e.g., a hash of `event.id`). On
receive: `if (already-processed(id)) return ack`. This makes retries
safe. Without idempotency, a message that succeeded but whose ack was
lost will be double-processed on redelivery.

---

# Transactional Outbox (Lesson 15)

The dual-write problem: writing to a database and publishing to a
broker are two separate operations. A crash between them silently
loses events. The fix is the outbox pattern: state write and event
publish share one transaction, so either both happen or neither does.

Dapr implements outbox as component metadata on any transactional
state store. No poller code, no outbox table to maintain.

Interview Question:

**Why not use a distributed transaction (2PC) between the DB and the broker?**

Answer:

Historically brittle, most modern brokers (Kafka, RabbitMQ) don't
support XA, and even when they do it kills throughput. The outbox
pattern gives the same guarantee (no lost events) with a single-DB
transaction, at the cost of at-least-once delivery.

Interview Question:

**What guarantee does outbox actually give — exactly-once or at-least-once?**

Answer:

At-least-once. The poller/forwarder can crash after publishing but
before marking the row done, leading to a re-publish. Consumers must
be idempotent. Exactly-once end-to-end is impossible in general
(acks can be lost); at-least-once + idempotent consumers is the
standard target.

Interview Question:

**Why did we pick Redis for `orderstore` but keep Mongo for the others?**

Answer:

Outbox requires the state store to support transactions. Redis does
natively (MULTI/EXEC); MongoDB requires a replica set for multi-doc
transactions, and our dev container is a single node. Rather than
initialise a replica set just to demo outbox, we introduced Redis for
the one store that needs it — which also shows off Dapr's per-
component pluggability.

Interview Question:

**A colleague enabled outbox metadata but no events are being published — what's wrong?**

Answer:

Almost certainly they're calling `client.state.save()` (the bulk-save
endpoint) instead of `client.state.transaction()`. Dapr's outbox is
hooked into the transactional endpoint only. The state gets persisted
correctly, so the bug is invisible unless you check the broker.
Symptom: outbox subscription exists in the sidecar startup log, but
no messages ever flow through it.

---

# Idempotent Consumers (Lesson 16)

Dapr Pub/Sub gives **at-least-once delivery**. Retries, outbox
forwarder crashes, and broker Nacks all mean the same event will
arrive more than once. Every subscriber must dedupe by the CloudEvent
`id`, which is stable across redeliveries.

Implementation pattern: a shared `IdempotencyService` backed by a
dedicated `dedupstore` (Redis with TTL). Each handler runs
`wasProcessed(event.id) → doWork() → markProcessed(event.id)`.

Interview Question:

**At-least-once *delivery* vs at-least-once *processing* — what's the difference?**

Answer:

Delivery is the broker's guarantee: the message will arrive at least
once. Processing is the consumer's guarantee: side effects run at
least once. A basic dedup guard converts one to the other, but leaves
a small race window (crash after business write, before mark).

Interview Question:

**How do you get true exactly-once *processing*?**

Answer:

Put the business write and the dedup mark in the same transaction
against a transactional state store. Then a crash between the two
is impossible — either both commit or neither does. The trade-off is
the consumer's state store must support transactions (Redis, or
Mongo replica set, or SQL).

Interview Question:

**Why the CloudEvent `id` and not the business id (like `orderId`)?**

Answer:

`orderId` is a domain identifier. Two logically different events
about the same order (Created, Cancelled) would collide. CloudEvent
`id` is the transport identifier — unique per publish, stable per
delivery. That's exactly the dedup semantic we want.
