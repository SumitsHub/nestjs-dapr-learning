# Lesson 8 - Dapr Secrets Management

## Goal

Store and retrieve secrets through Dapr instead of hardcoding sensitive information inside application code or configuration files.

Examples:

- Database credentials
- API Keys
- JWT Secrets
- SMTP Credentials
- Third-party service tokens

---

# Why Use Dapr Secrets?

Without Dapr:

```ts
const apiKey = 'my-secret-api-key';
```

Problems:

- Secrets are committed to source control.
- Secrets must be changed in application code.
- Different environments require code/config changes.

With Dapr:

```ts
await client.secret.get('secretstore', 'payment-provider');
```

The application does not know where the secret is stored.

Today:

```text
Local File
```

Tomorrow:

```text
HashiCorp Vault
AWS Secrets Manager
Azure Key Vault
Kubernetes Secrets
```

Application code remains unchanged.

---

# Architecture

```text
NestJS Application
        |
        v
Dapr Secret API
        |
        v
Dapr Sidecar
        |
        v
Secret Store Component
        |
        v
secrets.json
```

---

# Folder Structure

```text
nestjs-dapr-learning
|
├── dapr
│   ├── components
│   │   └── secretstore.yaml
│   │
│   └── secrets
│       └── secrets.json
│
├── apps
└── docs
```

---

# Create Secrets File

Create:

```text
dapr/secrets/secrets.json
```

Contents:

```json
{
  "mongodb": {
    "username": "admin",
    "password": "admin123"
  },
  "payment-provider": {
    "apiKey": "stripe-demo-key"
  }
}
```

---

# Create Secret Store Component

Create:

```text
dapr/components/secretstore.yaml
```

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: secretstore

spec:
  type: secretstores.local.file
  version: v1
  metadata:
    - name: secretsFile
      value: './dapr/secrets/secrets.json'

    - name: multiValued
      value: 'true'

    - name: nestedSeparator
      value: ':'
```

---

# Important Configuration

## multiValued

Required because our secrets contain nested objects.

Example:

```json
{
  "mongodb": {
    "username": "admin",
    "password": "admin123"
  }
}
```

Without:

```yaml
- name: multiValued
  value: 'true'
```

Dapr may load the component successfully but fail to locate secrets.

Typical error:

```text
secret mongodb not found
```

---

## nestedSeparator

Allows Dapr to work with nested secret values.

Example:

```json
{
  "mongodb": {
    "username": "admin"
  }
}
```

Internally can be represented using:

```text
mongodb:username
```

---

# Start Order Service With Dapr

```bash
dapr run \
  --app-id order-service \
  --app-port 3000 \
  --dapr-http-port 3500 \
  --resources-path ./dapr/components \
  -- yarn nest start order-service
```

---

# Verify Component Loaded

Check metadata:

```bash
curl http://localhost:3500/v1.0/metadata
```

Expected:

```json
{
  "name": "secretstore",
  "type": "secretstores.local.file"
}
```

inside the components list.

---

# Verify Secrets Directly Through Dapr

Always test Dapr components before writing application code.

Retrieve MongoDB secret:

```bash
curl http://localhost:3500/v1.0/secrets/secretstore/mongodb
```

Expected:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Retrieve payment provider secret:

```bash
curl http://localhost:3500/v1.0/secrets/secretstore/payment-provider
```

Expected:

```json
{
  "apiKey": "stripe-demo-key"
}
```

If these commands fail, the problem is in:

```text
Dapr Component Configuration
```

not in NestJS.

---

# Create Secret Service

Create:

```text
apps/order-service/src/secret.service.ts
```

```ts
import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';

@Injectable()
export class SecretService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
  }

  async getSecret(secretName: string) {
    return this.client.secret.get('secretstore', secretName);
  }
}
```

---

# Register Service

Update:

```text
apps/order-service/src/order-service.module.ts
```

Add:

```ts
providers: [SecretService];
```

or include it alongside existing providers.

---

# Create Test Endpoint

Example:

```ts
@Get('secret/:name')
async getSecret(
  @Param('name') name: string,
) {
  return this.secretService.getSecret(name);
}
```

---

# Test Through Application

Get MongoDB secret:

```bash
curl http://localhost:3000/orders/secret/mongodb
```

Expected:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Get payment provider secret:

```bash
curl http://localhost:3000/orders/secret/payment-provider
```

Expected:

```json
{
  "apiKey": "stripe-demo-key"
}
```

---

# Troubleshooting

## Component Loaded But Secret Not Found

Symptoms:

```text
secretstore appears in metadata
```

but:

```text
secret mongodb not found
```

Possible cause:

```yaml
multiValued: 'true'
```

missing from component configuration.

Fix:

```yaml
- name: multiValued
  value: 'true'
```

Restart Dapr sidecar after updating component.

---

## Verify File Exists

```bash
cat dapr/secrets/secrets.json
```

Ensure file contents match expected structure.

---

## Verify Metadata

```bash
curl http://localhost:3500/v1.0/metadata
```

Confirm:

```text
secretstore
```

is listed in loaded components.

---

# Key Learning

The application never directly accesses:

```text
secrets.json
```

Instead it accesses:

```text
Secret Store Component
```

through Dapr.

This allows us to switch later from:

```text
Local File
```

to:

```text
HashiCorp Vault
AWS Secrets Manager
Azure Key Vault
Kubernetes Secrets
```

without changing application business logic.

---

# Dapr Building Blocks Learned So Far

## Service Invocation

```text
Order Service
      |
      v
Payment Service
```

## Pub/Sub

```text
Order Service
      |
RabbitMQ
      |
Payment Service
```

## State Store

```text
Order Service
      |
Dapr State Store
      |
MongoDB
```

## Secret Store

```text
Order Service
      |
Dapr Secret Store
      |
Secrets Provider
```

These four building blocks form the foundation of most production Dapr applications.
