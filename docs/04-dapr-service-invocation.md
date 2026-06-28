# Lesson 4 - Dapr Service Invocation

## Before Dapr

Order Service directly called:

http://localhost:3001/payments

Problems:

- Hardcoded URL
- Tight coupling
- Difficult service discovery

---

## With Dapr

Order Service calls:

http://localhost:3500/v1.0/invoke/payment-service/method/payments

Benefits:

- Uses app-id instead of host
- Service discovery handled by Dapr
- Works consistently across environments

---

## Key Concept

Applications talk to their local Dapr sidecar.

Sidecars communicate with each other.

Applications do not communicate directly.

## Experiment - Payment Service Down

Stopped:

payment-service

Sent:

POST /orders

Result:

500 Internal Server Error

Observation:

Dapr Service Invocation does not automatically provide retries.

Service discovery is handled by Dapr.

Resiliency must be configured separately using Dapr resiliency policies.

## Experiment - Service Port Change

Changed Payment Service port:

3001 -> 3002

Observation:

Order Service code remained unchanged because invocation used:

payment-service (app-id)

instead of a hardcoded host/port.

Important:

The Dapr sidecar for Payment Service must be started with the correct --app-port value.

Dapr forwards traffic from the sidecar to the application using this configuration.