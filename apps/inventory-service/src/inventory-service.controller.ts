import { Body, Controller, Get, Post } from '@nestjs/common';
import type { PaymentCompletedEvent } from 'dapr-learning/common';
import { InventoryServiceService } from './inventory-service.service';
import { InventoryStateService } from './state.service';

@Controller()
export class InventoryServiceController {
  constructor(
    private readonly inventoryServiceService: InventoryServiceService,
    private readonly inventoryStateService: InventoryStateService,
  ) {}

  @Get()
  getHello(): string {
    return this.inventoryServiceService.getHello();
  }

  // Direct-invocation endpoint used by Dapr Workflow activities
  // (Lesson 17). Same business logic as the SubscriptionsController's
  // `handlePaymentCompleted`, minus the pubsub publish — the workflow
  // orchestrator is responsible for chaining the next step.
  @Post('inventory/reserve')
  async reserve(@Body() payload: PaymentCompletedEvent) {
    const reservation =
      await this.inventoryServiceService.reserveInventory(payload);
    await this.inventoryStateService.save(
      reservation.reservationId,
      reservation,
    );
    return reservation;
  }
}
