import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';
import { StateService } from './state.service';
import { SecretService } from './secret.service';
import {
  DaprCoreModule,
  PubSubService,
  InvocationService,
} from '@app/dapr-core';

@Module({
  imports: [HttpModule, DaprCoreModule],
  controllers: [OrderServiceController],
  providers: [
    OrderServiceService,
    PubSubService,
    StateService,
    SecretService,
    InvocationService,
  ],
})
export class OrderServiceModule {}
