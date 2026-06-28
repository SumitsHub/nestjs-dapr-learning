# Lesson 3 - Dapr Installation

## Environment

WSL Ubuntu 22.04
Node 22
NestJS Monorepo
Docker via Rancher Desktop

---

## Dapr Installation

Installed Dapr CLI:

wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash

---

## Verify

dapr version

---

## Initialize

dapr init

This installs local Dapr runtime components.

Typical local services:

- Redis
- Zipkin
- Placement Service
- Scheduler Service

---

## Important Observation

Older tutorials often use:

dapr status

Newer Dapr CLI versions use:

dapr status -k

for Kubernetes only.

For local development:

dapr list

is more useful.

---

## Learning

Dapr supports two execution modes:

1. Self Hosted
2. Kubernetes

Current learning path:

Self Hosted

Kubernetes will be introduced later.

---

## Key Takeaway

Dapr can run locally without Kubernetes.

This allows development and testing before deploying to a cluster.