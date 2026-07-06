import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrderCreatedEvent, PaymentCompletedEvent, TOPICS } from 'dapr-learning/common';
import type { CloudEvent } from 'dapr-learning/common';
import { PaymentServiceService } from './payment-service.service';
import { StateService } from './state.service';
import { PubSubService } from '@app/dapr-core';

@Controller()
export class SubscriptionsController {
  constructor(
    private readonly paymentService: PaymentServiceService,
    private readonly stateService: StateService,
    private readonly pubSubService: PubSubService,
  ) {}
  @Get('/dapr/subscribe')
  subscribe() {
    return [
      {
        pubsubname: 'pubsub',
        topic: TOPICS.ORDER_CREATED,
        route: 'orders/order-created',
        deadLetterTopic: TOPICS.PAYMENT_FAILED,
      },
      {
        pubsubname: 'pubsub',
        topic: TOPICS.PAYMENT_FAILED,
        route: 'payments/dead-letter',
      },
    ];
  }

  @Post('/orders/order-created')
  async handleOrderCreated(@Body() event: CloudEvent<OrderCreatedEvent>) {
    console.log('Received OrderCreated event');
    console.log(event);

    // Poison-message trigger for demonstrating retry + DLQ behavior.
    // Any orderId starting with "FAIL-" will always throw, exhaust the
    // retry policy defined in payment-resiliency.yaml, and get routed
    // to the payment-failed dead-letter topic.
    if (event.data.orderId?.startsWith('FAIL-')) {
      throw new Error(
        `Simulated permanent failure for orderId=${event.data.orderId}`,
      );
    }

    const payment = await this.paymentService.processPayment(event.data);

    // save payment state
    await this.stateService.save(payment.paymentId, payment);
    console.log(payment);

    // publish PaymentCompleted
    const paymentCompleted: PaymentCompletedEvent = {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      status: payment.status,
      processedAt: payment.processedAt,
      items: payment.items,
    };
    await this.pubSubService.publish(TOPICS.PAYMENT_COMPLETED, paymentCompleted);
    console.log('Published PaymentCompleted event');

    return { success: true };
  }

  @Post('/payments/dead-letter')
  async handleDeadLetter(@Body() event: CloudEvent<OrderCreatedEvent>) {
    console.error('=================================================');
    console.error('[DLQ] Payment permanently failed — moved to DLQ');
    console.error('[DLQ] orderId :', event.data?.orderId);
    console.error('[DLQ] amount  :', event.data?.amount);
    console.error('[DLQ] traceId :', (event as any).traceid ?? 'n/a');
    console.error('=================================================');
    // In production you would persist this for a human/operator to
    // inspect and replay. For now, acknowledging is enough — returning
    // 200 tells Dapr the DLQ handler is done.
    return { success: true };
  }
}
