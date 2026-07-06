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
                                                      │
                                                      ▼
                                              Inventory Service
                                                      │
                          ┌───────────────────────────┴───────────────────────────┐
                          │                                                       │
                Save Reservation                                     Publish InventoryReserved
                          │                                                       │
                          ▼                                                       ▼
                MongoDB (inventory)                                    RabbitMQ (Pub/Sub)
                                                                                  │
                                                                                  ▼
                                                                        Notification Service
                                                                                  │
                                          ┌───────────────────────────────────────┴──┐
                                          │                                          │
                                    Send Email + SMS                     Publish NotificationSent
                                          │                                          │
                                          ▼                                          ▼
                                       (mocks)                             RabbitMQ (Pub/Sub)
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
- Publish `PaymentCompleted` (must forward `items` from the order)

Owns

- `payments` MongoDB collection

---

### Inventory Service

Responsibilities

- Subscribe to `PaymentCompleted`
- Reserve inventory for the paid order's items
- Persist Reservation
- Publish `InventoryReserved`

Owns

- `inventory` MongoDB collection

---

### Notification Service

Responsibilities

- Subscribe to `InventoryReserved`
- Send Email + SMS (mocked)
- Publish `NotificationSent`

Owns

- No persistent store (fire-and-forget). Could later own a `notifications` collection for delivery audit.

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

| Service      | Collection |
| ------------ | ---------- |
| Order        | orders     |
| Payment      | payments   |
| Inventory    | inventory  |
| Notification | (none)     |

Every microservice owns its own data.

Services never write directly into another service's collection.

---

## Dapr Building Blocks Used

✅ Service Invocation

✅ Pub/Sub

✅ State Store

✅ Secret Store

✅ Resiliency (Service Invocation retries)

---

## Current Folder Structure

```text
apps/
    order-service/
    payment-service/
    inventory-service/
    notification-service/

libs/
    common/
    dapr-core/
```
