import { InventoryItemDto, InventoryStatus } from 'dapr-learning/common';

export class InventoryDto {
  reservationId: string;

  orderId: string;

  paymentId: string;

  items: InventoryItemDto[];

  status: InventoryStatus;

  reservedAt: Date;
}
