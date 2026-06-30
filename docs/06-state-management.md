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
