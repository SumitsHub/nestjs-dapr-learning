import { NestFactory } from '@nestjs/core';
import { PaymentServiceModule } from './payment-service.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(PaymentServiceModule);

  app.use(
    express.json({
      type: ['application/json', 'application/cloudevents+json'],
    }),
  );

  await app.listen(process.env.port ?? 3001);
}

bootstrap();
