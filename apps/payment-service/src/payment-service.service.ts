import { Injectable } from '@nestjs/common';
import { OrderCreatedEvent, PaymentStatus } from 'dapr-learning/common';

@Injectable()
export class PaymentServiceService {
  async processPayment(event: OrderCreatedEvent) {
    return {
      paymentId: crypto.randomUUID(),
      orderId: event.orderId,
      amount: event.amount,
      status: PaymentStatus.COMPLETED,
      processedAt: new Date(),
    };
  }
}
