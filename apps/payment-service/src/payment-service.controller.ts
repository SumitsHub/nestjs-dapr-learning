import { Body, Controller, Post } from '@nestjs/common';
import { CreatePaymentDto } from 'dapr-learning/common';

@Controller('payments')
export class PaymentServiceController {
  @Post()
  createPayment(@Body() payload: CreatePaymentDto) {
    console.log('Payment received:', payload);

    return {
      success: true,
      paymentId: crypto.randomUUID(),
      orderId: payload.orderId,
    };
  }
}