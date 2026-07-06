import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';

@Injectable()
export class SecretService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async getSecret(secretName: string) {
    return this.client.secret.get('secretstore', secretName);
  }
}
