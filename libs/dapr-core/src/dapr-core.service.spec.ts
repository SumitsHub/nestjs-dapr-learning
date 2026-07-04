import { Test, TestingModule } from '@nestjs/testing';
import { DaprCoreService } from './dapr-core.service';

describe('DaprCoreService', () => {
  let service: DaprCoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DaprCoreService],
    }).compile();

    service = module.get<DaprCoreService>(DaprCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
