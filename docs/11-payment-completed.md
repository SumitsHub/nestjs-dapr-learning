# PaymentCompleted Event

## Goal

After processing payment, publish a PaymentCompleted event.

Flow

```
OrderCreated
      │
      ▼
Payment Service
      │
Process Payment
      │
Persist Payment
      │
Publish PaymentCompleted
```

---

## Event

```ts
PaymentCompletedEvent;
```

Fields

- paymentId
- orderId
- amount
- status
- processedAt

---

## Why another event?

Services should communicate through business events.

Payment Service should not know who consumes the event.

Consumers can be

- Inventory Service
- Notification Service
- Analytics
- Fraud Detection

without modifying Payment Service.

---

## Testing

Create an order.

Expected flow

- Order saved
- OrderCreated published
- Payment received
- Payment processed
- Payment saved
- PaymentCompleted published

MongoDB

orders collection updated

payments collection updated

RabbitMQ

PaymentCompleted published successfully.
