import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';

@Injectable()
export class StateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
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
