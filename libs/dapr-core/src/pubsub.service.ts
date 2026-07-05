import { Injectable } from '@nestjs/common';
import { DaprClient, HttpMethod } from '@dapr/dapr';
import {
  CreateOrderDto,
  OrderCreatedEvent,
  TOPICS,
} from 'dapr-learning/common';

@Injectable()
export class PubSubService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
  }

  async publish(
    topic: string,
    data: string | object | undefined,
  ): Promise<void> {
    await this.client.pubsub.publish('pubsub', topic, data);
  }

  async invokePayment(data: CreateOrderDto) {
    return this.client.invoker.invoke(
      'payment-service',
      'payments',
      HttpMethod.POST,
      data,
    );
  }
}
