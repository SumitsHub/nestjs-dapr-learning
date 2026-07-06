import { DaprClient } from '@dapr/dapr';

/**
 * Every DaprClient instance must talk to *its own* sidecar. `dapr run`
 * exports `DAPR_HTTP_PORT` into the process env; using it prevents the
 * "everything publishes through port 3500" bug that hides itself in
 * local dev but breaks tracing and multi-replica deployments.
 */
export function createDaprClient(): DaprClient {
  return new DaprClient({
    daprHost: process.env.DAPR_HOST ?? '127.0.0.1',
    daprPort: process.env.DAPR_HTTP_PORT ?? '3500',
  });
}
