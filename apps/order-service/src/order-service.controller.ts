import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { OrderServiceService } from './order-service.service';
import { SecretService } from './secret.service';

@Controller('orders')
export class OrderServiceController {
  constructor(
    private readonly orderService: OrderServiceService,
    private readonly secretService: SecretService,
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
}
