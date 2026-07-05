import { NestFactory } from '@nestjs/core';
import { NotificationServiceModule } from './notification-service.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  app.use(
    express.json({
      type: ['application/json', 'application/cloudevents+json'],
    }),
  );

  await app.listen(process.env.port ?? 3003);
}
bootstrap();
