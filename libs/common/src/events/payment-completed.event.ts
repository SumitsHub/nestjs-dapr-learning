import { PaymentStatus } from '../enums';

export class PaymentCompletedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  processedAt: Date;
}
