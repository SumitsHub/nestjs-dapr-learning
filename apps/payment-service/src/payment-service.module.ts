import { Module } from '@nestjs/common';
import { PaymentServiceController } from './payment-service.controller';
import { PaymentServiceService } from './payment-service.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StateService } from './state.service';
import { DaprCoreModule } from '@app/dapr-core';

@Module({
  imports: [DaprCoreModule],
  controllers: [PaymentServiceController, SubscriptionsController],
  providers: [PaymentServiceService, StateService],
})
export class PaymentServiceModule {}
