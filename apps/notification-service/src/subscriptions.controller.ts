import { Body, Controller, Get, Post } from '@nestjs/common';
import { TOPICS } from 'dapr-learning/common';
import type { CloudEvent, InventoryReservedEvent } from 'dapr-learning/common';
import { IdempotencyService, PubSubService } from '@app/dapr-core';
import { NotificationMapper } from './mappers/notification.mapper';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class SubscriptionsController {
  constructor(
    private readonly pubSubService: PubSubService,
    private readonly notificationService: NotificationServiceService,
    private readonly idempotency: IdempotencyService,
  ) {}
  @Get('/dapr/subscribe')
  subscribe() {
    return [
      {
        pubsubname: 'pubsub',
        topic: TOPICS.INVENTORY_RESERVED,
        route: 'notification/inventory-reserved',
      },
    ];
  }
  @Post('/notification/inventory-reserved')
  async handleInventoryReserved(
    @Body()
    event: CloudEvent<InventoryReservedEvent>,
  ) {
    if (await this.idempotency.wasProcessed(event.id)) {
      console.log(`[idempotency] skipping duplicate inventory-reserved eventId=${event.id}`);
      return { success: true };
    }

    console.log('Received InventoryReserved');
    console.log(event.data);

    // send notification
    const notification = await this.notificationService.sendNotification(
      event.data,
    );
    console.log('Notification sent', notification);

    await this.pubSubService.publish(
      TOPICS.NOTIFICATION_SENT,
      NotificationMapper.toNotificationSentEvent(notification),
    );

    await this.idempotency.markProcessed(event.id);
    return { success: true };
  }
}
