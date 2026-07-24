import type { WorkflowContext } from '@dapr/dapr';
import type { CreateOrderDto, OrderCreatedEvent } from 'dapr-learning/common';
import { OrderStatus } from 'dapr-learning/common';
import { processPaymentActivity } from './activities/process-payment.activity';
import { reserveInventoryActivity } from './activities/reserve-inventory.activity';
import { sendNotificationActivity } from './activities/send-notification.activity';

/**
 * The order saga workflow.
 *
 * Reads top to bottom like ordinary code. The magic is what Dapr does
 * BEHIND every `yield`:
 *   - Serializes the workflow state to `workflowstore` (Redis).
 *   - Suspends the workflow.
 *   - When the activity returns, wakes the workflow, replays it from
 *     history, and resumes at the next line.
 *
 * That's why activities MUST be idempotent and workflow bodies MUST
 * be deterministic (no Math.random, no Date.now — use ctx.getCurrentUtcDateTime).
 *
 * If the process crashes mid-saga, another order-service replica (or
 * the same one after restart) picks up where the last activity left
 * off. No manual bookkeeping required.
 */
export const ORDER_SAGA_WORKFLOW = 'OrderSagaWorkflow';

export interface OrderSagaResult {
  orderId: string;
  status: 'COMPLETED' | 'FAILED';
  paymentId?: string;
  reservationId?: string;
  notificationId?: string;
  error?: string;
}

export function* orderSagaWorkflow(
  ctx: WorkflowContext,
  input: CreateOrderDto,
): Generator<unknown, OrderSagaResult, any> {
  const startedAt = ctx.getCurrentUtcDateTime();

  const orderCreated: OrderCreatedEvent = {
    orderId: input.orderId,
    amount: input.amount,
    status: OrderStatus.CREATED,
    createdAt: startedAt,
    items: [{ sku: 'SKU-123', quantity: 2 }],
  };

  try {
    // Step 1 — payment
    const payment = yield ctx.callActivity(processPaymentActivity, orderCreated);

    // Step 2 — inventory
    const reservation = yield ctx.callActivity(reserveInventoryActivity, payment);

    // Step 3 — notification
    const notification = yield ctx.callActivity(sendNotificationActivity, reservation);

    return {
      orderId: input.orderId,
      status: 'COMPLETED',
      paymentId: payment.paymentId,
      reservationId: reservation.reservationId,
      notificationId: notification.notificationId,
    };
  } catch (err) {
    // In a real saga you would yield compensation activities here
    // (release inventory, refund payment). Kept out of scope for
    // this lesson — see docs/17-workflows.md "Compensations" section.
    return {
      orderId: input.orderId,
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
