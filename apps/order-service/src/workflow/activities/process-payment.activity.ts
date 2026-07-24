import type { WorkflowActivityContext } from '@dapr/dapr';
import { DaprClient, HttpMethod } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';
import type {
  OrderCreatedEvent,
  PaymentCompletedEvent,
} from 'dapr-learning/common';
import { PaymentStatus } from 'dapr-learning/common';

/**
 * Activity: process the payment for an order.
 *
 * Activities are plain async functions. They:
 *  - Are invoked by the workflow orchestrator, one durable step at a time.
 *  - Have no dependency on Nest DI — Dapr's WorkflowRuntime calls them
 *    directly via a registered function reference.
 *  - Should be idempotent — Dapr may retry them after a crash.
 *  - Must NOT talk to the workflow context except via their arguments
 *    and return value.
 *
 * We reach downstream services with Dapr Service Invocation. That
 * routes through payment-service's sidecar, so retries, mTLS, and
 * tracing all apply automatically.
 */
const client: DaprClient = createDaprClient();

export const processPaymentActivity = async (
  _ctx: WorkflowActivityContext,
  input: OrderCreatedEvent,
): Promise<PaymentCompletedEvent> => {
  const response = (await client.invoker.invoke(
    'payment-service',
    'payments',
    HttpMethod.POST,
    { orderId: input.orderId, amount: input.amount },
  )) as { paymentId: string };

  return {
    paymentId: response.paymentId,
    orderId: input.orderId,
    amount: input.amount,
    status: PaymentStatus.COMPLETED,
    processedAt: new Date(),
    items: input.items,
  };
};
