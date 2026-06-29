# Lesson 5 - Pub/Sub with RabbitMQ

## Goal

Move from synchronous communication to event-driven communication.

---

## Previous Architecture

Order Service
      |
      v
Payment Service

Characteristics:

- Synchronous
- Tight coupling
- Request waits for response

---

## Target Architecture

Order Service
      |
      v
Dapr Pub/Sub
      |
      v
RabbitMQ
      |
      +--> Payment Service
      +--> Inventory Service
      +--> Notification Service

Characteristics:

- Event-driven
- Loosely coupled
- Multiple subscribers