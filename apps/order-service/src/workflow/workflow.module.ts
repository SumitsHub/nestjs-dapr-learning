import { Module } from '@nestjs/common';
import { WorkflowClientService } from './workflow-client.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { WorkflowController } from './workflow.controller';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowRuntimeService, WorkflowClientService],
})
export class WorkflowModule {}
