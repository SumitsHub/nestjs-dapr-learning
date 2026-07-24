import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';
import { StateService } from './state.service';
import { SecretService } from './secret.service';
import { DaprCoreModule, InvocationService } from '@app/dapr-core';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [HttpModule, DaprCoreModule, WorkflowModule],
  controllers: [OrderServiceController],
  providers: [
    OrderServiceService,
    StateService,
    SecretService,
    InvocationService,
  ],
})
export class OrderServiceModule {}
