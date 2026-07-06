import { InventoryItemDto, PaymentStatus } from 'dapr-learning/common';

export class PaymentDto {
  paymentId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  processedAt: Date;
  items: InventoryItemDto[];
}
