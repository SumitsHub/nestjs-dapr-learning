import { Module } from '@nestjs/common';
import { DaprCoreService } from './dapr-core.service';

@Module({
  providers: [DaprCoreService],
  exports: [DaprCoreService],
})
export class DaprCoreModule {}
