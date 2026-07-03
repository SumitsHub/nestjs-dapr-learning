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
