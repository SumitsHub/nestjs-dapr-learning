import { Module } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [PubSubService, IdempotencyService],
  exports: [PubSubService, IdempotencyService],
})
export class DaprCoreModule {}
