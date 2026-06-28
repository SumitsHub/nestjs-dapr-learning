# Lesson 2 - Service-to-Service Communication (Without Dapr)

## Goal

Understand traditional microservice communication before introducing Dapr.

---

## Architecture

Client
  |
  v
Order Service (3000)
  |
  | HTTP POST
  v
Payment Service (3001)

---

## Flow

1. Client sends POST /orders
2. Order Service receives request
3. Order Service calls Payment Service
4. Payment Service processes payment
5. Payment Service returns response
6. Order Service returns combined response

---

## Example Request

POST /orders

{
  "orderId": "ORD-1",
  "amount": 100
}

---

## Example Response

{
  "orderCreated": true,
  "payment": {
    "success": true,
    "paymentId": "uuid",
    "orderId": "ORD-1"
  }
}

---

## Shared DTOs

Location:

libs/common/src/dtos

Purpose:

- Reuse contracts
- Avoid duplication
- Maintain consistency between services

Examples:

- CreateOrderDto
- CreatePaymentDto

---

## Problems Identified

### Problem 1 - Hardcoded URLs

Order Service depends on:

http://localhost:3001/payments

If Payment Service moves to another port,
Order Service code must change.

---

### Problem 2 - Service Discovery

Order Service must know:

- Host
- Port
- Protocol

As the number of services grows,
configuration becomes difficult.

---

### Problem 3 - Failure Handling

If Payment Service is down:

- Request fails
- Order creation fails

No retry mechanism exists.

---

### Problem 4 - Tight Coupling

Order Service directly knows:

- Payment Service location
- Communication protocol

This increases coupling between services.

---

## Experiment

Stop Payment Service.

Send:

curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "orderId":"ORD-2",
  "amount":100
}'

Observe:

- Order Service logs
- Error response
- Failure behavior

---

## Key Learning

Traditional microservice communication works,
but introduces operational complexity:

- Service discovery
- Resiliency
- Retries
- Configuration management

These are some of the problems Dapr aims to solve.