# System Architecture

## Project Goal

This repository demonstrates how to build a production-oriented microservices application using NestJS and Dapr.

The objective is not only to learn Dapr APIs, but also to understand how distributed systems are designed, implemented, and evolved using modern architectural patterns.

---

# Technology Stack

| Layer               | Technology        |
| ------------------- | ----------------- |
| Language            | TypeScript        |
| Framework           | NestJS 11         |
| Runtime             | Node.js           |
| Package Manager     | Yarn              |
| Architecture        | Monorepo          |
| Distributed Runtime | Dapr              |
| Messaging           | RabbitMQ          |
| Database            | MongoDB           |
| State Management    | Dapr State Store  |
| Secret Management   | Dapr Secret Store |

---

# Current Architecture

```text
                     Client
                        |
                        |
                Order Service
                        |
      +-----------------+----------------+
      |                                  |
      |                                  |
Service Invocation                 Pub/Sub
(Synchronous)                  (Asynchronous)
      |                                  |
      |                                  |
Payment Service <------ RabbitMQ ---------+
      |
      |
MongoDB (State Store)
```

Every application runs with its own Dapr sidecar.

```text
+---------------------+
| Order Service       |
+---------------------+
| Dapr Sidecar        |
+---------------------+

+---------------------+
| Payment Service     |
+---------------------+
| Dapr Sidecar        |
+---------------------+
```

The application communicates with the local Dapr sidecar instead of directly communicating with infrastructure such as RabbitMQ or MongoDB.

---

# Current Services

## Order Service

Responsibilities:

- Accept client requests
- Publish business events
- Invoke other services
- Persist order state
- Retrieve secrets through Dapr

Dapr Building Blocks:

- Service Invocation
- Pub/Sub
- State Store
- Secret Store

---

## Payment Service

Responsibilities:

- Consume OrderCreated events
- Process payments (currently simulated)
- Participate in synchronous service invocation

Dapr Building Blocks:

- Pub/Sub Subscriber
- State Store (available)
- Secret Store (available)

---

# Shared Library

Shared contracts are maintained inside:

```text
libs/common
```

Current shared assets include:

- DTOs
- Events
- Enums
- Interfaces
- Constants

This provides a single source of truth for service-to-service communication.

---

# Communication Patterns

## Service Invocation

Used when an immediate response is required.

Examples:

- Payment authorization
- Inventory availability
- Validation requests

Characteristics:

- Synchronous
- Request/Response
- Tighter coupling
- Supports retries and timeouts

---

## Pub/Sub

Used for business events.

Examples:

- Order Created
- Payment Completed
- Inventory Reserved

Characteristics:

- Asynchronous
- Loosely coupled
- Event-driven
- Publisher is unaware of subscribers

---

# Infrastructure

## RabbitMQ

Purpose:

- Message broker for asynchronous communication.

Current Topic:

```text
order-created
```

---

## MongoDB

Purpose:

- State Store backend

Current collection:

```text
state
```

Managed through Dapr rather than direct MongoDB access.

---

## Local Secret Store

Purpose:

Store development secrets outside application code.

Current secrets:

- MongoDB credentials
- Payment provider API key

---

# Folder Structure

```text
apps/
    order-service/
    payment-service/

libs/
    common/
        dtos/
        events/
        enums/
        interfaces/
        constants/

dapr/
    components/
    secrets/
    resiliency/

docs/
```

---

# Current Dapr Building Blocks

| Building Block     | Status         |
| ------------------ | -------------- |
| Service Invocation | ✅             |
| Pub/Sub            | ✅             |
| State Store        | ✅             |
| Secret Store       | ✅             |
| Resiliency         | 🚧 In Progress |
| Configuration      | Planned        |
| Workflow           | Planned        |
| Actors             | Planned        |

---

# Future Roadmap

The project will gradually evolve by introducing:

- Inventory Service
- Notification Service
- Resiliency Policies
- Distributed Workflows
- Multi-Tenant Architecture
- OpenTelemetry
- Distributed Tracing
- Kubernetes Deployment
- Production Readiness Improvements

The goal is to evolve the system incrementally while keeping it deployable and production-oriented throughout the learning journey.
