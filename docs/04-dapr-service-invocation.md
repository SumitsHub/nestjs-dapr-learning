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

## Running Applications with Dapr

### Traditional Startup

Without Dapr:

```bash
nest start payment-service
```

The application starts and listens on its configured port.

Example:

```text
Payment Service
└── localhost:3001
```

Applications communicate directly using hostnames and ports.

---

### Dapr Startup

With Dapr:

```bash
dapr run \
  --app-id payment-service \
  --app-port 3001 \
  --dapr-http-port 3501 \
  -- yarn nest start payment-service
```

This starts:

1. The NestJS application
2. A Dapr sidecar process

Architecture:

```text
Payment Service
      ^
      |
localhost:3001
      |
Payment Dapr Sidecar
      ^
      |
localhost:3501
```

---

### Understanding the Parameters

#### --app-id

```bash
--app-id payment-service
```

Unique name used by Dapr to identify the application.

Other services invoke it using:

```text
payment-service
```

instead of a hostname and port.

Example:

```text
http://localhost:3500/v1.0/invoke/payment-service/method/payments
```

---

#### --app-port

```bash
--app-port 3001
```

Port on which the application listens.

Dapr forwards incoming requests to this port.

Example:

```text
Dapr Sidecar
     |
     v
localhost:3001
```

If the application port changes, this value must be updated.

---

#### --dapr-http-port

```bash
--dapr-http-port 3501
```

Port exposed by the Dapr sidecar.

Applications communicate with the sidecar through this port.

Example:

```text
Order Service
      |
      v
localhost:3500
```

---

### Verifying Running Applications

List running Dapr applications:

```bash
dapr list
```

Example:

```text
APP ID            APP PORT
order-service     3000
payment-service   3001
```

This command shows application sidecars, not Dapr infrastructure services.

---

### Key Learning

Applications no longer communicate directly.

Instead:

```text
Application
    |
    v
Local Dapr Sidecar
    |
    v
Remote Dapr Sidecar
    |
    v
Remote Application
```

This enables:

* Service discovery
* Consistent invocation APIs
* Resiliency features
* Observability
* Protocol abstraction

```
```

## Understanding Dapr Ports

Order Service:

Application Port: 3000
Dapr HTTP Port: 3500

Payment Service:

Application Port: 3001
Dapr HTTP Port: 3501

Applications communicate with their local Dapr sidecar.

Example:

Order Service
      |
      v
localhost:3500
      |
      v
payment-service (app-id)
      |
      v
Payment Sidecar
      |
      v
localhost:3001

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