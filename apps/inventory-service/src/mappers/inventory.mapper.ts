import { InventoryDto } from '../dtos/inventory.dto';
import { InventoryReservedEvent } from 'dapr-learning/common';

export class InventoryMapper {
  static toInventoryReservedEvent(
    inventory: InventoryDto,
  ): InventoryReservedEvent {
    return {
      reservationId: inventory.reservationId,
      paymentId: inventory.paymentId,
      orderId: inventory.orderId,
      items: inventory.items,
      status: inventory.status,
      reservedAt: inventory.reservedAt,
    };
  }
}
