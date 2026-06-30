# Lesson 5 - Pub/Sub with RabbitMQ

## Goal

Move from synchronous service-to-service communication to event-driven communication using Dapr Pub/Sub and RabbitMQ.

---

## Previous Architecture

```text
Client
    |
POST /orders
    |
Order Service
    |
HTTP Call
    |
Payment Service
```

Characteristics:

- Synchronous
- Tight coupling
- Order Service must know Payment Service
- Request waits for downstream response

---

## Target Architecture

```text
Client
    |
POST /orders
    |
Order Service
    |
Publish Event
    |
Dapr Pub/Sub
    |
RabbitMQ
    |
    +--> Payment Service
    +--> Inventory Service
    +--> Notification Service
```

Characteristics:

- Event-driven
- Loosely coupled
- Multiple consumers
- Publisher does not know subscribers

---

# Setup Steps

## 1. Start RabbitMQ

Create:

```text
infra/docker-compose.yml
```

```yaml
services:
  rabbitmq:
    image: rabbitmq:4-management
    container_name: rabbitmq
    ports:
      - '5672:5672'
      - '15672:15672'
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
```

Start:

```bash
cd infra
docker compose up -d
```

Verify:

```bash
docker ps | grep rabbitmq
```

Expected:

```text
rabbitmq container running
```

---

## 2. Verify RabbitMQ UI

Open:

```text
http://localhost:15672
```

Credentials:

```text
username: admin
password: admin
```

---

## 3. Create Dapr Pub/Sub Component

Create:

```text
dapr/components/pubsub.yaml
```

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub

spec:
  type: pubsub.rabbitmq
  version: v1
  metadata:
    - name: host
      value: 'amqp://admin:admin@localhost:5672'
    - name: durable
      value: 'true'
    - name: deletedWhenUnused
      value: 'false'
    - name: autoAck
      value: 'false'
```

---

## 4. Install Dapr SDK

```bash
yarn add @dapr/dapr
```

Verify:

```bash
yarn list --pattern @dapr
```

Installed version:

```text
@dapr/dapr@3.18.0
```

---

# Shared Event Contract

Create:

```text
libs/common/src/events/order-created.event.ts
```

```ts
export class OrderCreatedEvent {
  orderId: string;
  amount: number;
}
```

Export from:

```text
libs/common/src/index.ts
```

---

# Publisher Implementation

## Dapr Service

Create:

```text
apps/order-service/src/dapr.service.ts
```

Publisher:

```ts
await this.client.pubsub.publish('pubsub', 'order-created', data);
```

## Order Service

Instead of:

```text
HTTP -> Payment Service
```

publish:

```ts
await this.daprService.publishOrderCreated({
  orderId,
  amount,
});
```

Return:

```json
{
  "orderCreated": true,
  "eventPublished": true
}
```

---

# Subscriber Implementation

## Subscription Discovery Endpoint

Create:

```text
GET /dapr/subscribe
```

Example response:

```json
[
  {
    "pubsubname": "pubsub",
    "topic": "order-created",
    "route": "orders/order-created"
  }
]
```

Purpose:

Dapr discovers which topics the application wants to consume.

Verification:

```bash
curl http://localhost:3001/dapr/subscribe
```

---

## Event Handler

```ts
@Post('/orders/order-created')
async handleOrderCreated(@Body() event: any) {
  console.log(event);

  return {
    success: true,
  };
}
```

---

# Starting Applications

## Payment Service

```bash
dapr run \
  --app-id payment-service \
  --app-port 3001 \
  --dapr-http-port 3501 \
  --resources-path ./dapr/components \
  -- yarn nest start payment-service
```

## Order Service

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  -- yarn nest start order-service
```

Verify:

```bash
dapr list
```

Expected:

```text
order-service
payment-service
```

---

# Component Verification

Verify Dapr loaded RabbitMQ component:

```bash
curl http://localhost:3501/v1.0/metadata
```

Expected:

```json
{
  "components": [
    {
      "name": "pubsub",
      "type": "pubsub.rabbitmq"
    }
  ]
}
```

---

# Publishing Events

Create order:

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "orderId":"ORD-101",
  "amount":500
}'
```

Expected response:

```json
{
  "orderCreated": true,
  "eventPublished": true
}
```

Payment Service receives:

```json
{
  "orderId": "ORD-101",
  "amount": 500
}
```

---

# Troubleshooting

## Verify Subscription Discovery

```bash
curl http://localhost:3001/dapr/subscribe
```

If you get:

```json
{
  "message": "Cannot GET /dapr/subscribe"
}
```

then Dapr cannot discover subscriptions.

---

## Verify Dapr Component

```bash
curl http://localhost:3501/v1.0/metadata
```

Ensure:

```text
pubsub.rabbitmq
```

appears.

---

## Verify RabbitMQ

```bash
docker ps | grep rabbitmq
```

---

## Verify Event Delivery

Publish directly through Dapr:

```bash
curl -X POST \
http://localhost:3500/v1.0/publish/pubsub/order-created \
-H "Content-Type: application/json" \
-d '{"orderId":"TEST-1","amount":999}'
```

---

# Key Learnings

## Service Invocation vs Pub/Sub

### Service Invocation

```text
Order Service
      |
      v
Payment Service
```

Order Service knows Payment Service.

---

### Pub/Sub

```text
Order Service
      |
Publish Event
      |
RabbitMQ
      |
Subscribers
```

Order Service knows only:

```text
order-created
```

---

## Benefits

- Loose coupling
- Multiple subscribers
- Independent deployment
- Easier scaling
- Broker abstraction through Dapr

---

## Important Dapr Concept

Applications never communicate directly with RabbitMQ.

Applications communicate with:

```text
Local Dapr Sidecar
```

Dapr communicates with RabbitMQ.

This abstraction allows RabbitMQ to be replaced later with Kafka, Azure Service Bus, Redis Streams, or another supported broker with minimal application code changes.

## Understanding RabbitMQ UI

Overview - Health and metrics
Connections - Dapr to RabbitMQ connections
Exchanges - Message routing layer
Queues - Stored messages awaiting consumption
Ready -Waiting messages
Unacked - Delivered but not acknowledged
Consumers - Active subscribers
