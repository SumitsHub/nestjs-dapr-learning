import { Injectable } from '@nestjs/common';
import { DaprClient, HttpMethod } from '@dapr/dapr';
import { createDaprClient } from './dapr-client.factory';

@Injectable()
export class InvocationService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async invoke<TRequest extends object = any, TResponse = any>(
    appId: string,
    method: string,
    httpMethod: HttpMethod,
    data?: TRequest,
  ): Promise<TResponse> {
    return this.client.invoker.invoke(
      appId,
      method,
      httpMethod,
      data,
    ) as Promise<TResponse>;
  }
}
