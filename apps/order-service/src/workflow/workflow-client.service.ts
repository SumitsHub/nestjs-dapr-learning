import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DaprWorkflowClient } from '@dapr/dapr';
import type { CreateOrderDto } from 'dapr-learning/common';
import { ORDER_SAGA_WORKFLOW } from './order-saga.workflow';

/**
 * Thin wrapper around DaprWorkflowClient so controllers can inject a
 * NestJS provider instead of a raw SDK class.
 */
@Injectable()
export class WorkflowClientService implements OnApplicationShutdown {
  private readonly client: DaprWorkflowClient;

  constructor() {
    this.client = new DaprWorkflowClient({
      daprHost: process.env.DAPR_HOST ?? '127.0.0.1',
      daprPort: process.env.DAPR_GRPC_PORT ?? '50001',
    });
  }

  async startOrderSaga(input: CreateOrderDto): Promise<string> {
    return this.client.scheduleNewWorkflow(ORDER_SAGA_WORKFLOW, input);
  }

  async getState(instanceId: string) {
    return this.client.getWorkflowState(instanceId, true);
  }

  async terminate(instanceId: string) {
    return this.client.terminateWorkflow(instanceId, null);
  }

  async onApplicationShutdown() {
    await this.client.stop();
  }
}
