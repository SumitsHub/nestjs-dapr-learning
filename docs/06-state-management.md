# Lesson 6 - Dapr State Management

## Goal

Store and retrieve application state through Dapr without directly using database-specific APIs.

---

## Architecture

Traditional:

```text
Application
     |
Mongo Driver
     |
MongoDB
```

Dapr:

```text
Application
     |
Dapr Sidecar
     |
State Store
```

Benefits:

- Database abstraction
- Easier migration
- Consistent API
- Reduced infrastructure coupling

---

# MongoDB Setup

## Add MongoDB to Docker Compose

Update:

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

  mongodb:
    image: mongo:8
    container_name: mongodb
    ports:
      - '27017:27017'
```

Start infrastructure:

```bash
cd infra

docker compose up -d
```

Verify:

```bash
docker ps
```

Expected:

```text
rabbitmq
mongodb
```

---

# Verify MongoDB Connectivity

Check whether MongoDB is reachable from WSL:

```bash
nc -zv localhost 27017
```

Expected:

```text
Connection to localhost (127.0.0.1) 27017 succeeded
```

This confirms:

```text
WSL -> Docker -> MongoDB
```

connectivity is working.

---

# Dapr MongoDB State Store Component

Create:

```text
dapr/components/statestore.yaml
```

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore

spec:
  type: state.mongodb
  version: v1
  metadata:
    - name: host
      value: 'localhost:27017'
    - name: databaseName
      value: 'dapr-learning'
    - name: collectionName
      value: 'state'
```

---

# Important Learning

Incorrect:

```yaml
- name: host
  value: 'mongodb://localhost:27017'
```

This may cause component initialization failures.

Correct:

```yaml
- name: host
  value: 'localhost:27017'
```

For the Dapr MongoDB state store component, the `host` metadata expects a host:port value rather than a MongoDB URI.

---

# Verify Component Loading

Restart Dapr sidecars and verify:

```bash
curl http://localhost:3500/v1.0/metadata
```

Expected:

```json
{
  "components": [
    {
      "name": "statestore",
      "type": "state.mongodb"
    }
  ]
}
```

This confirms Dapr successfully connected to MongoDB and loaded the state store component.

## MongoDB State Store Component

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore

spec:
  type: state.mongodb
  version: v1
```

Component name:

```text
statestore
```

This name is referenced by application code.

---

## Verification

```bash
curl http://localhost:3500/v1.0/metadata
```

Expected:

```text
statestore
```

appears in loaded components.

# Saving and Retrieving Order State

## Goal

Persist order data using Dapr State Store without directly using MongoDB drivers or Mongoose.

Architecture:

```text
Order Service
     |
Dapr State API
     |
Dapr Sidecar
     |
MongoDB
```

The application only knows about:

```text
statestore
```

The actual database implementation is hidden behind Dapr.

---

## State Service

Create:

```text
apps/order-service/src/state.service.ts
```

Responsibilities:

- Save order state
- Retrieve order state

Implementation:

```ts
@Injectable()
export class StateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
  }

  async saveOrder(order: any) {
    await this.client.state.save('statestore', [
      {
        key: order.orderId,
        value: order,
      },
    ]);
  }

  async getOrder(orderId: string) {
    return this.client.state.get('statestore', orderId);
  }
}
```

---

## Register State Service

Update:

```text
apps/order-service/src/order-service.module.ts
```

Add:

```ts
providers: [DaprService, StateService];
```

This allows Order Service to use Dapr State APIs.

---

## Saving Order State

When a new order is created:

```ts
await this.stateService.saveOrder({
  orderId: payload.orderId,
  amount: payload.amount,
  status: 'CREATED',
  createdAt: new Date().toISOString(),
});
```

Then publish the event:

```ts
await this.daprService.publishOrderCreated({
  orderId: payload.orderId,
  amount: payload.amount,
});
```

Flow:

```text
Create Order
     |
Save State
     |
Publish Event
```

This ensures order information exists even if downstream consumers fail.

---

## Reading Order State

Add endpoint:

```http
GET /orders/:orderId
```

Controller:

```ts
@Get(':orderId')
async getOrder(
  @Param('orderId') orderId: string,
) {
  return this.orderService.getOrder(orderId);
}
```

Service:

```ts
async getOrder(orderId: string) {
  return this.stateService.getOrder(orderId);
}
```

---

## Testing Save

Create order:

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "orderId":"ORD-500",
  "amount":999
}'
```

Expected:

```json
{
  "orderCreated": true,
  "eventPublished": true
}
```

---

## Testing Read

Retrieve order:

```bash
curl http://localhost:3000/orders/ORD-500
```

Expected:

```json
{
  "orderId": "ORD-500",
  "amount": 999,
  "status": "CREATED",
  "createdAt": "2026-06-30T..."
}
```

---

## Verifying Data in MongoDB

Open Mongo shell:

```bash
docker exec -it mongodb mongosh
```

List databases:

```javascript
show dbs
```

Select database:

```javascript
use dapr-learning
```

View stored records:

```javascript
db.state.find().pretty();
```

Expected document:

```json
{
  "_id": "ORD-500",
  "value": {
    "orderId": "ORD-500",
    "amount": 999,
    "status": "CREATED"
  }
}
```

---

## Key Learning

Without Dapr:

```ts
await orderModel.create(...)
await orderModel.findOne(...)
```

Application becomes tightly coupled to MongoDB.

With Dapr:

```ts
await client.state.save(...)
await client.state.get(...)
```

Application only depends on:

```text
statestore
```

The underlying database can later be changed to:

- Redis
- PostgreSQL
- Cosmos DB
- DynamoDB
- Cassandra

with minimal application code changes.

---

## Dapr Building Blocks Learned So Far

### Service Invocation

```text
Order Service
      |
      v
Payment Service
```

### Pub/Sub

```text
Order Service
      |
RabbitMQ
      |
Payment Service
```

### State Management

```text
Order Service
      |
Dapr State Store
      |
MongoDB
```

These three building blocks form the foundation of most production Dapr applications.
