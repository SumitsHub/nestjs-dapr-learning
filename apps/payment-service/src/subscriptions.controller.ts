import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrderCreatedEvent, TOPICS } from 'dapr-learning/common';
import type { CloudEvent } from 'dapr-learning/common';
import { PaymentServiceService } from './payment-service.service';
import { StateService } from './state.service';

@Controller()
export class SubscriptionsController {
  constructor(
    private readonly paymentService: PaymentServiceService,
    private readonly stateService: StateService,
  ) {}
  @Get('/dapr/subscribe')
  subscribe() {
    return [
      {
        pubsubname: 'pubsub',
        topic: TOPICS.ORDER_CREATED,
        route: 'orders/order-created',
      },
    ];
  }

  @Post('/orders/order-created')
  async handleOrderCreated(@Body() event: CloudEvent<OrderCreatedEvent>) {
    console.log('Received OrderCreated event');
    console.log(event);
    const payment = await this.paymentService.processPayment(event.data);

    // save payment state
    await this.stateService.save(payment.paymentId, payment);
    console.log(payment);

    // publish PaymentCompleted

    return { success: true };
  }
}
