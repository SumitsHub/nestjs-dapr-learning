# Current Flow

POST /orders

↓

Order Service

↓

OrderCreated

↓

Payment Service

↓

PaymentCompleted

---

Expected Logs

Order Service

- Order saved
- OrderCreated published

Payment Service

- OrderCreated received
- Payment processed
- Payment saved
- PaymentCompleted published
