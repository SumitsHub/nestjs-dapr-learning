import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateOrderDto } from 'dapr-learning/common';
import { WorkflowClientService } from './workflow-client.service';

@Controller('orders/workflow')
export class WorkflowController {
  constructor(private readonly workflowClient: WorkflowClientService) {}

  /**
   * Start a new order-saga workflow.
   * Returns the workflow instance ID — use it to poll status.
   */
  @Post()
  async start(@Body() payload: CreateOrderDto) {
    const instanceId = await this.workflowClient.startOrderSaga(payload);
    return { instanceId, statusUrl: `/orders/workflow/${instanceId}` };
  }

  /**
   * Read current state of a running or completed workflow.
   * Response includes runtimeStatus (RUNNING, COMPLETED, FAILED),
   * output payload, and history if fetchPayloads=true.
   */
  @Get(':id')
  async status(@Param('id') id: string) {
    const state = await this.workflowClient.getState(id);
    if (!state) {
      throw new NotFoundException(`workflow instance ${id} not found`);
    }
    return {
      instanceId: id,
      status: state.runtimeStatus,
      createdAt: state.createdAt,
      lastUpdatedAt: state.lastUpdatedAt,
      input: state.serializedInput,
      output: state.serializedOutput,
      failureDetails: state.workflowFailureDetails,
    };
  }

  @Delete(':id')
  async terminate(@Param('id') id: string) {
    await this.workflowClient.terminate(id);
    return { instanceId: id, terminated: true };
  }
}
