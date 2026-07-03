import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { OrderServiceService } from './order-service.service';
import { SecretService } from './secret.service';
import { DaprService } from './dapr.service';

@Controller('orders')
export class OrderServiceController {
  constructor(
    private readonly orderService: OrderServiceService,
    private readonly secretService: SecretService,
    private readonly daprService: DaprService,
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
    const response = await this.daprService.invokePayment(body);
    console.log('Payment response received');
    return {
      success: true,
      payment: response,
    };
  }
}
