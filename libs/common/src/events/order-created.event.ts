export class OrderCreatedEvent {
  orderId: string;
  amount: number;
  status: string;
  createdAt: Date;
}
