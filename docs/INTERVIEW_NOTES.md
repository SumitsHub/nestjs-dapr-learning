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
