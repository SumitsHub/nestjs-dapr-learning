# Lesson 7 - ETags and Optimistic Concurrency

## Goal

Prevent accidental overwrites when multiple clients update the same state simultaneously.

---

## Problem: Lost Updates

Initial state:

```json
{
  "status": "CREATED"
}
```

Two clients read the same order.

Client A:

```json
{
  "status": "PAID"
}
```

Client B:

```json
{
  "status": "CANCELLED"
}
```

Without concurrency control:

```text
Last write wins
```

and one update is lost.

---

## Solution: ETags

An ETag represents a version of state.

Example:

```json
{
  "data": {
    "orderId": "ORD-500"
  },
  "etag": "ABC123"
}
```

When saving:

```text
Update only if ETag still matches
```

If another update happened first:

```text
State save fails
```

allowing the application to retry or notify the user.

---

## Benefits

- Prevents lost updates
- Improves data consistency
- Supports concurrent workloads
- Essential for production systems
