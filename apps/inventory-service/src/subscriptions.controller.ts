import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { TOPICS } from 'dapr-learning/common';
import type { CloudEvent, PaymentCompletedEvent } from 'dapr-learning/common';
import {
  IdempotencyService,
  LockUnavailableError,
  PubSubService,
} from '@app/dapr-core';
import {
  InsufficientStockError,
  InventoryServiceService,
} from './inventory-service.service';
import { InventoryMapper } from './mappers/inventory.mapper';

@Controller()
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly inventoryService: InventoryServiceService,
    private readonly pubSubService: PubSubService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('/dapr/subscribe')
  subscribe() {
    return [
      {
        pubsubname: 'pubsub',
        topic: TOPICS.PAYMENT_COMPLETED,
        route: 'inventory/payment-completed',
      },
    ];
  }

  @Post('/inventory/payment-completed')
  async handlePaymentCompleted(
    @Body()
    event: CloudEvent<PaymentCompletedEvent>,
  ) {
    if (await this.idempotency.wasProcessed(event.id)) {
      this.logger.log(
        `[idempotency] skipping duplicate payment-completed eventId=${event.id}`,
      );
      return { success: true };
    }

    try {
      const reservation = await this.inventoryService.reserveForPayment(
        event.data,
      );

      await this.pubSubService.publish(
        TOPICS.INVENTORY_RESERVED,
        InventoryMapper.toInventoryReservedEvent(reservation),
      );

      await this.idempotency.markProcessed(event.id);
      return { success: true };
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        // Business-level rejection. Ack (return 200) so the broker
        // doesn't redeliver forever \u2014 a permanent condition. In a real
        // system you'd publish an OrderRejected / RefundRequested event
        // here so the customer is refunded.
        this.logger.warn(
          `[reject] insufficient stock for order ${event.data.orderId}: ${err.message}`,
        );
        await this.idempotency.markProcessed(event.id);
        return { success: true };
      }
      if (err instanceof LockUnavailableError) {
        // Transient. Let Dapr redeliver (via the pubsubInboundRetry
        // policy from Lesson 14) by returning an error.
        throw err;
      }
      throw err;
    }
  }
}
