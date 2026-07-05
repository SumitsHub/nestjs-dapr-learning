import { InventoryReservedEvent } from 'dapr-learning/common';
import { InventoryDto } from './dtos/inventory.dto';

export class InventoryMapper {
  static toInventoryReservedEvent(
    inventory: InventoryDto,
  ): InventoryReservedEvent {
    return {
      reservationId: inventory.reservationId,
      orderId: inventory.orderId,
      paymentId: inventory.paymentId,
      items: inventory.items,
      status: inventory.status,
      reservedAt: inventory.reservedAt,
    };
  }
}
