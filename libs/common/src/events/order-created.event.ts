import { OrderStatus } from '../enums';

export class OrderCreatedEvent {
  orderId: string;
  amount: number;
  status: OrderStatus;
  createdAt: Date;
}
