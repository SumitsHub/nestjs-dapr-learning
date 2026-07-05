import { Injectable } from '@nestjs/common';
import { PaymentCompletedEvent, InventoryStatus } from 'dapr-learning/common';
import { InventoryDto } from './dtos/inventory.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryServiceService {
  getHello(): string {
    return 'Hello World!';
  }

  async reserveInventory(event: PaymentCompletedEvent): Promise<InventoryDto> {
    return {
      reservationId: randomUUID(),
      paymentId: event.paymentId,
      orderId: event.orderId,

      items: event.items,

      status: InventoryStatus.RESERVED,

      reservedAt: new Date(),
    };
  }
}
