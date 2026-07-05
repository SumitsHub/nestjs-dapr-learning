import { Injectable } from '@nestjs/common';
import { DaprClient, HttpMethod } from '@dapr/dapr';

@Injectable()
export class InvocationService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3500',
    });
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
