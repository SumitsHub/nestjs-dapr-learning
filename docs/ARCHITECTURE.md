# Architecture Overview

## Current Architecture

```text
                  Client
                     │
                     ▼
              Order Service
                     │
      ┌──────────────┴──────────────┐
      │                             │
 Save Order State             Publish OrderCreated
      │                             │
      ▼                             ▼
 MongoDB (orders)             RabbitMQ (Pub/Sub)
                                    │
                                    ▼
                            Payment Service
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
          Save Payment State              Publish PaymentCompleted
                 │                                     │
                 ▼                                     ▼
          MongoDB (payments)              RabbitMQ (Pub/Sub)
```

---

## Services

### Order Service

Responsibilities

- Create Orders
- Persist Orders
- Publish `OrderCreated`
- Invoke other services when needed

Owns

- `orders` MongoDB collection

---

### Payment Service

Responsibilities

- Subscribe to `OrderCreated`
- Process Payment
- Persist Payment
- Publish `PaymentCompleted`

Owns

- `payments` MongoDB collection

---

## Shared Libraries

### libs/common

Contains shared domain contracts.

Examples

- DTOs
- Events
- Enums
- Constants
- Shared Interfaces

No infrastructure code belongs here.

---

### libs/dapr-core

Contains shared Dapr infrastructure.

Current services

- `PubSubService`
- `InvocationService`

Future additions

- Workflow
- Actors
- Locks

---

## Event Flow

```text
Client
   │
POST /orders
   │
   ▼
Order Service
   │
   ├── Save Order
   └── Publish OrderCreated
                │
                ▼
RabbitMQ
                │
                ▼
Payment Service
                │
                ├── Process Payment
                ├── Save Payment
                └── Publish PaymentCompleted
```

---

## Data Ownership

| Service | Collection |
| ------- | ---------- |
| Order   | orders     |
| Payment | payments   |

Every microservice owns its own data.

Services never write directly into another service's collection.

---

## Dapr Building Blocks Used

✅ Service Invocation

✅ Pub/Sub

✅ State Store

✅ Secret Store

---

## Current Folder Structure

```text
apps/
    order-service/
    payment-service/

libs/
    common/
    dapr-core/
```
