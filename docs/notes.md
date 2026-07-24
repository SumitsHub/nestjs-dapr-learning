## Dapr's major building blocks are:

Service Invocation
Pub/Sub
State Management
Secrets
Observability
Resiliency
Bindings
Workflows
Kubernetes Deployment

Updated Roadmap
✅ Service Invocation
✅ Pub/Sub
✅ State Store
➡️ ETags & Optimistic Concurrency
➡️ Resiliency Policies
➡️ Secrets Management
➡️ Observability (Tracing/Metrics)
➡️ Multi-Tenant Architecture
➡️ Dapr Workflows
➡️ Kubernetes Deployment
➡️ Production Architecture Review

## Learning Progress

### Completed

- Service Invocation
- Pub/Sub (RabbitMQ)
- State Management (MongoDB)

### Upcoming

- State Transactions
- Secrets Management
- Resiliency Policies
- Observability
- Optimistic Concurrency (ETags)
- Multi-Tenant Architecture
- Workflows
- Kubernetes Deployment

### Important Observation

Using `@dapr/dapr@3.18.0`, the State API returns only the stored value:

```ts id="n4t5zb"
await client.state.get(...)
```

Example response:

```json id="3rj7b2"
{
  "amount": 999,
  "createdAt": "...",
  "orderId": "ORD-500",
  "status": "CREATED"
}
```

ETags are not exposed through the current SDK response and will be explored later using Dapr runtime APIs directly.

## Dapr endpoints

curl http://localhost:3500/v1.0/metadata

## Enable Dapr Debug Logs

When starting order-service sidecar:

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  --log-level debug \
  -- yarn nest start order-service
```

## Learning Roadmap

### ✅ Phase 1 - Fundamentals

- [x] Service Invocation
- [x] Pub/Sub
- [x] State Store
- [x] Secret Store

### ✅ Phase 2 - Project Foundation

- [x] Shared common library
- [x] Shared dapr-core library
- [x] CloudEvents
- [x] Separate Mongo collections
- [x] Event-driven architecture

### 🚧 Phase 3 - Business Workflow

- [x] OrderCreated
- [x] PaymentCompleted
- [x] InventoryReserved
- [x] NotificationSent

### ⏳ Phase 4 - Production Features

- [x] Observability (Distributed Tracing / Zipkin)
- [x] Retry / Resiliency (Pub/Sub inbound)
- [x] Dead Letter Queue
- [x] Outbox Pattern
- [x] Idempotent Consumers
- [x] Workflow
- [x] Distributed Locks
- [ ] Actors (direct usage)
- [ ] Multi-tenancy
- [ ] Metrics (Prometheus/Grafana)
- [ ] Kubernetes
