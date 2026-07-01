import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';

@Injectable()
export class SecretService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
  }

  async getSecret(secretName: string) {
    return this.client.secret.get('secretstore', secretName);
  }
}
