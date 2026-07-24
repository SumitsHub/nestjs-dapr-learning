import { Module } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { IdempotencyService } from './idempotency.service';
import { LockService } from './lock.service';

@Module({
  providers: [PubSubService, IdempotencyService, LockService],
  exports: [PubSubService, IdempotencyService, LockService],
})
export class DaprCoreModule {}
