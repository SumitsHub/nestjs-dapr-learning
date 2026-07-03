import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';

@Injectable()
export class StateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
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
