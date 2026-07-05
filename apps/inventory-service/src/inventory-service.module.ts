import { Module } from '@nestjs/common';
import { InventoryServiceController } from './inventory-service.controller';
import { InventoryServiceService } from './inventory-service.service';
import { DaprCoreModule, PubSubService } from '@app/dapr-core';
import { SubscriptionsController } from './subscriptions.controller';
import { InventoryStateService } from './state.service';

@Module({
  imports: [DaprCoreModule],
  controllers: [InventoryServiceController, SubscriptionsController],
  providers: [InventoryServiceService, PubSubService, InventoryStateService],
})
export class InventoryServiceModule {}
