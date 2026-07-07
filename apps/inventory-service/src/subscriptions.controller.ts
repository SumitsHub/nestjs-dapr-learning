import { Body, Controller, Get, Post } from '@nestjs/common';
import { TOPICS } from 'dapr-learning/common';
import type { CloudEvent, PaymentCompletedEvent } from 'dapr-learning/common';
import { IdempotencyService, PubSubService } from '@app/dapr-core';
import { InventoryStateService } from './state.service';
import { InventoryServiceService } from './inventory-service.service';
import { InventoryMapper } from './mappers/inventory.mapper';

@Controller()
export class SubscriptionsController {
  constructor(
    private readonly inventoryService: InventoryServiceService,
    private readonly inventoryStateService: InventoryStateService,
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
      console.log(`[idempotency] skipping duplicate payment-completed eventId=${event.id}`);
      return { success: true };
    }

    console.log('Received PaymentCompleted');
    console.log(event.data);

    const reservation = await this.inventoryService.reserveInventory(
      event.data,
    );

    await this.inventoryStateService.save(
      reservation.reservationId,
      reservation,
    );

    await this.pubSubService.publish(
      TOPICS.INVENTORY_RESERVED,
      InventoryMapper.toInventoryReservedEvent(reservation),
    );
    console.log('Published InventoryReserved event');

    await this.idempotency.markProcessed(event.id);
    return { success: true };
  }
}
