import { Body, Controller, Get, Post } from '@nestjs/common';
import type { InventoryReservedEvent } from 'dapr-learning/common';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class NotificationServiceController {
  constructor(
    private readonly notificationServiceService: NotificationServiceService,
  ) {}

  @Get()
  getHello(): string {
    return this.notificationServiceService.getHello();
  }

  // Direct-invocation endpoint used by Dapr Workflow activities
  // (Lesson 17). Same business logic as the SubscriptionsController's
  // `handleInventoryReserved`, minus the pubsub publish.
  @Post('notifications/send')
  async send(@Body() payload: InventoryReservedEvent) {
    return this.notificationServiceService.sendNotification(payload);
  }
}
