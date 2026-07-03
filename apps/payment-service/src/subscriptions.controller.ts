import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrderCreatedEvent } from 'dapr-learning/common';

@Controller()
export class SubscriptionsController {
  @Get('/dapr/subscribe')
  subscribe() {
    return [
      {
        pubsubname: 'pubsub',
        topic: 'order-created',
        route: 'orders/order-created',
      },
    ];
  }

  @Post('/orders/order-created')
  async handleOrderCreated(@Body() event: OrderCreatedEvent) {
    console.log('Received OrderCreated event');
    console.log(event);

    return {
      success: true,
    };
  }
}
