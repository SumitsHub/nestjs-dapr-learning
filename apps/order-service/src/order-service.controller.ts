import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { OrderServiceService } from './order-service.service';

@Controller('orders')
export class OrderServiceController {
  constructor(private readonly orderService: OrderServiceService) {}

  @Post()
  create(@Body() payload: CreateOrderDto) {
    return this.orderService.createOrder(payload);
  }
}