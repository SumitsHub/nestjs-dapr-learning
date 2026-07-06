import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { OrderServiceService } from './order-service.service';
import { SecretService } from './secret.service';
import { InvocationService } from 'libs/dapr-core/src/invocation.service';
import { HttpMethod } from '@dapr/dapr';

@Controller('orders')
export class OrderServiceController {
  constructor(
    private readonly orderService: OrderServiceService,
    private readonly secretService: SecretService,
    private readonly invocationService: InvocationService,
  ) {}

  @Post()
  create(@Body() payload: CreateOrderDto) {
    return this.orderService.createOrder(payload);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.orderService.getOrder(orderId);
  }

  @Get('secret/:name')
  async getSecret(@Param('name') name: string) {
    return this.secretService.getSecret(name);
  }

  // This endpoint is for testing the invocation of the payment service with resiliency (retries) via Dapr.
  @Post('pay-now')
  async payNow(@Body() body: CreateOrderDto) {
    console.log('Invoking payment service...');
    const response = await this.invocationService.invoke(
      'payment-service',
      'payments',
      HttpMethod.POST,
      body,
    );
    console.log('Payment response received');
    return {
      success: true,
      payment: response,
    };
  }

  // Lesson 15 chaos endpoint.
  //
  // Saves the order, then throws BEFORE this handler can do anything
  // else. With the outbox pattern, the sidecar has already committed
  // the state AND published OrderCreated in a single transaction, so
  // the downstream chain still fires normally.
  //
  // Without the outbox (Lesson 12's pattern), a separate publish()
  // call sat *after* saveOrder(). This throw would abort it and the
  // event would be lost forever.
  @Post('chaos')
  async chaos(@Body() body: CreateOrderDto) {
    await this.orderService.createOrder(body);
    throw new HttpException(
      `Simulated crash AFTER save. If outbox works, orderId=${body.orderId} still triggered the full chain.`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
