import { Module } from '@nestjs/common';
import { NotificationServiceController } from './notification-service.controller';
import { NotificationServiceService } from './notification-service.service';
import { SmsService, EmailService } from './services';
import { SubscriptionsController } from './subscriptions.controller';
import { DaprCoreModule, PubSubService } from '@app/dapr-core';

@Module({
  imports: [DaprCoreModule],
  controllers: [NotificationServiceController, SubscriptionsController],
  providers: [
    NotificationServiceService,
    EmailService,
    SmsService,
    PubSubService,
  ],
})
export class NotificationServiceModule {}
