import { Injectable } from '@nestjs/common';
import { OrderCreatedEvent, PaymentStatus } from 'dapr-learning/common';
import { randomUUID } from 'crypto';

import { PaymentDto } from './dtos/payment.dto';

@Injectable()
export class PaymentServiceService {
  async processPayment(event: OrderCreatedEvent): Promise<PaymentDto> {
    return {
      paymentId: randomUUID(),
      orderId: event.orderId,
      amount: event.amount,
      status: PaymentStatus.COMPLETED,
      processedAt: new Date(),
    };
  }
}
