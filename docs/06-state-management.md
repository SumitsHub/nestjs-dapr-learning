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
