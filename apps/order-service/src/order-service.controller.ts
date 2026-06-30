import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { OrderServiceService } from './order-service.service';

@Controller('orders')
export class OrderServiceController {
  constructor(private readonly orderService: OrderServiceService) {}

  @Post()
  create(@Body() payload: CreateOrderDto) {
    return this.orderService.createOrder(payload);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.orderService.getOrder(orderId);
  }
}
