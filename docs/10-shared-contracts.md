# Lesson 10 - Shared Contracts

## Why Shared Contracts?

In a microservice architecture, multiple services exchange the same data.

If every service defines its own DTOs and events independently, they can easily drift apart over time, leading to runtime failures and inconsistent APIs.

A shared library provides a single source of truth for these contracts.

---

## Folder Structure

```text
libs/common/src/
├── dto/
├── events/
├── enums/
├── constants/
├── interfaces/
└── index.ts
```

### dto/

Represents requests and responses exchanged with clients or between services.

Example:

- CreateOrderDto
- CreatePaymentDto

### events/

Represents immutable business events published through Dapr Pub/Sub.

Example:

- OrderCreatedEvent
- PaymentCompletedEvent

Events describe something that has already happened and should not be modified.

### enums/

Contains shared enumerations such as:

- OrderStatus
- PaymentStatus

Using enums instead of strings improves consistency and reduces errors.

### constants/

Contains shared constants such as:

- Pub/Sub topic names
- Header names
- Configuration keys

This avoids scattering magic strings throughout the codebase.

### interfaces/

Contains shared TypeScript interfaces for reusable domain models.

---

## Public API

The shared library exposes its contracts through:

```text
libs/common/src/index.ts
```

Consumers should import only from the library root:

```ts
import { CreateOrderDto, OrderCreatedEvent } from 'dapr-learning/common';
```

This hides the internal folder structure and makes refactoring easier.

---

## Benefits

- Single source of truth
- Strong typing across services
- Easier refactoring
- Better IDE support
- Fewer integration bugs
- Cleaner imports

This pattern scales well as additional services are added to the monorepo.
