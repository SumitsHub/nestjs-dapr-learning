import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PaymentCompletedEvent } from 'dapr-learning/common';
import { LockUnavailableError } from '@app/dapr-core';
import {
  InsufficientStockError,
  InventoryServiceService,
} from './inventory-service.service';

@Controller()
export class InventoryServiceController {
  constructor(
    private readonly inventoryService: InventoryServiceService,
  ) {}

  @Get()
  getHello(): string {
    return this.inventoryService.getHello();
  }

  // Lesson 18 \u2014 Seed stock for a SKU.
  //   curl -X POST http://localhost:3002/inventory/stock/SKU-123 \
  //     -H 'Content-Type: application/json' -d '{"quantity":10}'
  @Post('inventory/stock/:sku')
  async setStock(
    @Param('sku') sku: string,
    @Body() body: { quantity: number },
  ) {
    if (typeof body?.quantity !== 'number' || body.quantity < 0) {
      throw new BadRequestException('quantity must be a non-negative number');
    }
    await this.inventoryService.setStock(sku, body.quantity);
    return { sku, quantity: body.quantity };
  }

  @Get('inventory/stock/:sku')
  async getStock(@Param('sku') sku: string) {
    return { sku, quantity: await this.inventoryService.getStock(sku) };
  }

  // Direct-invocation endpoint used by Dapr Workflow activities (Lesson 17)
  // and, via a shared service method, by the pub/sub subscriber
  // (Lesson 12 choreography). Both paths now share the stock check and
  // per-SKU lock introduced in Lesson 18.
  @Post('inventory/reserve')
  async reserve(@Body() payload: PaymentCompletedEvent) {
    try {
      return await this.inventoryService.reserveForPayment(payload);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof LockUnavailableError) {
        throw new ServiceUnavailableException(err.message);
      }
      throw err;
    }
  }
}
