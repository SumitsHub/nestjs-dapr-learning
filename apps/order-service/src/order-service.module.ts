import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';
import { DaprService } from './dapr.service';
import { StateService } from './state.service';

@Module({
  imports: [HttpModule],
  controllers: [OrderServiceController],
  providers: [OrderServiceService, DaprService, StateService],
})
export class OrderServiceModule {}
