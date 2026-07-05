import { OrderStatus } from '../enums';
import { InventoryItemDto } from '../dtos';

export class OrderCreatedEvent {
  orderId: string;
  amount: number;
  status: OrderStatus;
  createdAt: Date;
  items: InventoryItemDto[];
}
