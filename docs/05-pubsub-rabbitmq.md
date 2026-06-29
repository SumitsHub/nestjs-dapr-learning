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


## Setup Steps

### 1. Start RabbitMQ

Create:

infra/docker-compose.yml

Run:

docker compose up -d

Verify:

docker ps

Expected:

rabbitmq container running

---

### 2. Verify RabbitMQ UI

Open:

http://localhost:15672

Credentials:

username: admin
password: admin

---

### 3. Create Dapr Pub/Sub Component

Create:

dapr/components/pubsub.yaml

Configure RabbitMQ connection.

---

### 4. Start Applications Using Dapr

All applications must be started using:

dapr run

so Dapr can discover Pub/Sub components.