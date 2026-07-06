import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';

@Injectable()
export class StateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async saveOrder(order: any) {
    await this.client.state.save('orderstore', [
      {
        key: order.orderId,
        value: order,
      },
    ]);
  }

  async getOrder(orderId: string) {
    return this.client.state.get('orderstore', orderId);
  }
}
