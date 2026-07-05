# Dapr Command Reference

## Initial HTTP Version (No Dapr)

Payment Service

```bash
yarn nest start payment-service
```

Order Service

```bash
yarn nest start order-service
```

Communication:

```text
Order Service
    |
    v
http://localhost:3001/payments
```

---

## Dapr Service Invocation Version

Payment Service

```bash
dapr run \
  --app-id payment-service \
  --app-port 3001 \
  --dapr-http-port 3501 \
  --resources-path ./dapr/components \
  -- yarn nest start payment-service
```

Order Service

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  -- yarn nest start order-service
```

Inventory Service

```bash
dapr run \
  --app-id inventory-service \
  --app-port 3002 \
  --dapr-http-port 3502 \
  --resources-path ./dapr/components \
  -- yarn nest start inventory-service
```

Communication:

```text
Order Service
    |
localhost:3500
    |
    v
payment-service (app-id)
```

Invocation URL:

```text
http://localhost:3500/v1.0/invoke/payment-service/method/payments
```

---

## Useful Verification Commands

Check installed version:

```bash
dapr version
```

List running Dapr applications:

```bash
dapr list
```

Verify sidecar metadata:

```bash
curl http://localhost:3500/v1.0/metadata
```

or

```bash
curl http://localhost:3501/v1.0/metadata
```

Verify subscription discovery endpoint:

```bash
curl http://localhost:3001/dapr/subscribe
```

---

## Infrastructure Commands

Start RabbitMQ:

```bash
cd infra
docker compose up -d
```

Stop RabbitMQ:

```bash
docker compose down
```

Verify RabbitMQ:

```bash
docker ps | grep rabbitmq
```

RabbitMQ UI:

```text
http://localhost:15672
```

Credentials:

```text
admin / admin
```

---

## Architecture Evolution

### Phase 1

```text
Order Service
      |
      v
Payment Service
```

Direct HTTP

---

### Phase 2

```text
Order Service
      |
      v
Order Dapr Sidecar
      |
      v
Payment Dapr Sidecar
      |
      v
Payment Service
```

Service Invocation

---

### Phase 3 (Current Goal)

```text
Order Service
      |
Publish Event
      |
      v
RabbitMQ
      |
      v
Payment Service
```

Pub/Sub

```

```

## Generate library

nest g library dapr-core

## Generate service

nest g app inventory-service
