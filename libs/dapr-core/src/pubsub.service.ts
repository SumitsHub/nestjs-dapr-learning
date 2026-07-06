import { Injectable } from '@nestjs/common';
import { DaprClient, HttpMethod } from '@dapr/dapr';
import {
  CreateOrderDto,
} from 'dapr-learning/common';
import { createDaprClient } from './dapr-client.factory';

@Injectable()
export class PubSubService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async publish<T = unknown>(topic: string, data: T): Promise<void> {
    await this.client.pubsub.publish('pubsub', topic, data as object);
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
