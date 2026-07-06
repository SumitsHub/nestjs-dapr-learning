# Lesson 9 - Resiliency

## Goal

Handle temporary failures automatically without adding retry logic to application code.

---

## Why Resiliency Matters

In distributed systems:

- Services restart
- Networks fail
- Containers crash
- Dependencies become temporarily unavailable

These failures are often short-lived.

Without retries:

```text
Request -> Fail
```

With retries:

```text
Request -> Retry -> Success
```

---

## Benefits

- Improved reliability
- Fewer transient failures
- Less retry logic in application code
- Consistent behavior across services

---

## Types of Resiliency

### Retries

Retry failed operations automatically.

### Timeouts

Prevent requests from hanging indefinitely.

### Circuit Breakers

Stop sending requests to unhealthy services.

These policies are configured in Dapr rather than implemented separately in each microservice.

## Retry Policy

Create:

```text id="b2kq7x"
dapr/resiliency/payment-resiliency.yaml
```

> **Folder note.** `kind: Resiliency` is a *resource*, not a component,
> so it belongs in its own folder — not under `dapr/components/`.
> Dapr's `--resources-path` flag is repeatable, and `dapr.yaml`
> supports `resourcesPaths` (plural), so both directories are loaded:
>
> ```yaml
> common:
>   resourcesPaths:
>     - ./dapr/components
>     - ./dapr/resiliency
> ```
>
> An earlier version of this project kept the file under
> `dapr/components/` as a workaround for a single-path setup. That is
> no longer needed.

```yaml id="1l2xrf"
apiVersion: dapr.io/v1alpha1
kind: Resiliency
metadata:
  name: payment-resiliency

spec:
  policies:
    retries:
      paymentRetry:
        policy: constant
        duration: 2s
        maxRetries: 3

  targets:
    apps:
      payment-service:
        retry: paymentRetry
```

Behavior:

```text id="ej2tr6"
Attempt 1 -> Fail
Wait 2s

Attempt 2 -> Fail
Wait 2s

Attempt 3 -> Fail
Wait 2s

Return Error
```

The application code remains unchanged while Dapr handles retry behavior.

# Testing Retry Policies Using Service Invocation

## Why This Endpoint Exists

Our normal order flow uses Pub/Sub:

```text
Order Service
      |
      v
RabbitMQ
      |
      v
Payment Service
```

When Payment Service is stopped, Order Service can still successfully publish events because RabbitMQ is available.

As a result:

```text
Retry policies are NOT triggered.
```

To properly test Dapr Resiliency, we need a synchronous dependency.

---

## Temporary Testing Endpoint

Endpoint:

```http
POST /orders/pay-now
```

Flow:

```text
Order Service
      |
      v
Dapr Service Invocation
      |
      v
Payment Service
```

This endpoint directly invokes Payment Service through Dapr.

Because the dependency is synchronous, retry policies can be observed when Payment Service becomes unavailable.

---

## Test Scenario 1 - Happy Path

Start:

- Order Service
- Payment Service
- Both Dapr sidecars

Request:

```bash
curl -X POST http://localhost:3000/orders/pay-now \
-H "Content-Type: application/json" \
-d '{
  "orderId":"ORD-999",
  "amount":100
}'
```

Expected:

```json
{
  "success": true,
  "payment": {
    ...
  }
}
```

---

## Test Scenario 2 - Retry Validation

Start:

- Order Service
- Order Service Dapr sidecar

Stop:

- Payment Service
- Payment Service Dapr sidecar

Run:

```bash
time curl -X POST http://localhost:3000/orders/pay-now \
-H "Content-Type: application/json" \
-d '{
  "orderId":"ORD-999",
  "amount":100
}'
```

Expected:

- Request does NOT fail immediately.
- Dapr retries according to resiliency policy.
- Failure occurs only after retry attempts are exhausted.

Example:

```text
Attempt 1 -> Fail
Wait 2s

Attempt 2 -> Fail
Wait 2s

Attempt 3 -> Fail
Wait 2s

Return Error
```

Total execution time should approximately match the configured retry delays.

---

## Enable Dapr Debug Logs

To observe retry behavior more clearly, start the Order Service sidecar with debug logging:

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  --log-level debug \
  -- yarn nest start order-service
```

Debug logs may show:

- Service invocation attempts
- Retry attempts
- Connection failures
- Resiliency policy activity

This is useful for understanding how Dapr behaves internally during transient failures.

---

## Cleanup

This endpoint is intended only for learning and validation.

Once resiliency concepts are understood, it can be:

- Removed completely, or
- Kept under a dedicated testing controller.

Production business flows should use real application use cases rather than artificial resiliency test endpoints.
