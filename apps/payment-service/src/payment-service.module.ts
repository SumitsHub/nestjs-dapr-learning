import { Module } from '@nestjs/common';
import { PaymentServiceController } from './payment-service.controller';
import { PaymentServiceService } from './payment-service.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [],
  controllers: [PaymentServiceController, SubscriptionsController],
  providers: [PaymentServiceService],
})
export class PaymentServiceModule {}
