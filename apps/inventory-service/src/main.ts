import { NestFactory } from '@nestjs/core';
import { InventoryServiceModule } from './inventory-service.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(InventoryServiceModule);

  app.use(
    express.json({
      type: ['application/json', 'application/cloudevents+json'],
    }),
  );

  await app.listen(process.env.port ?? 3002);
}
bootstrap();
