import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { WorkflowRuntime } from '@dapr/dapr';
import {
  ORDER_SAGA_WORKFLOW,
  orderSagaWorkflow,
} from './order-saga.workflow';
import { processPaymentActivity } from './activities/process-payment.activity';
import { reserveInventoryActivity } from './activities/reserve-inventory.activity';
import { sendNotificationActivity } from './activities/send-notification.activity';

/**
 * Boots the Dapr WorkflowRuntime inside order-service on startup,
 * registers our workflow + activities, and drains gracefully on
 * shutdown.
 *
 * Only ONE service in the monorepo (order-service) hosts the runtime.
 * The other services are pure activity targets — they don't need to
 * know about workflows at all.
 */
@Injectable()
export class WorkflowRuntimeService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkflowRuntimeService.name);
  private runtime?: WorkflowRuntime;

  async onModuleInit() {
    this.runtime = new WorkflowRuntime({
      daprHost: process.env.DAPR_HOST ?? '127.0.0.1',
      daprPort: process.env.DAPR_GRPC_PORT ?? '50001',
    });

    this.runtime
      .registerWorkflowWithName(ORDER_SAGA_WORKFLOW, orderSagaWorkflow as any)
      .registerActivity(processPaymentActivity)
      .registerActivity(reserveInventoryActivity)
      .registerActivity(sendNotificationActivity);

    // `start()` returns a Promise that resolves only when the runtime
    // shuts down. We deliberately do NOT await it — that would block
    // Nest bootstrap forever.
    void this.runtime.start().catch((err) => {
      this.logger.error('workflow runtime crashed', err);
    });

    this.logger.log('workflow runtime started');
  }

  async onApplicationShutdown() {
    if (this.runtime) {
      await this.runtime.stop();
      this.logger.log('workflow runtime stopped');
    }
  }
}
