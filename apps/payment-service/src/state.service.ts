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

  async save(key: string, value: any) {
    await this.client.state.save('paymentstore', [
      {
        key,
        value,
      },
    ]);
  }

  async getPayment(paymentId: string) {
    return this.client.state.get('paymentstore', paymentId);
  }
}
