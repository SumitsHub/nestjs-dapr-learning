import { Injectable } from '@nestjs/common';
import {
  InventoryReservedEvent,
  NotificationChannel,
  NotificationStatus,
} from 'dapr-learning/common';
import { NotificationDto } from './dtos/notification.dto';
import { randomUUID } from 'crypto';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';

@Injectable()
export class NotificationServiceService {
  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  async sendNotification(
    event: InventoryReservedEvent,
  ): Promise<NotificationDto> {
    const message = this.buildMessage(event);

    await this.emailService.send(message);

    await this.smsService.send(message);

    return {
      notificationId: randomUUID(),
      orderId: event.orderId,
      reservationId: event.reservationId,
      message,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      paymentId: event.paymentId,
    };
  }

  private buildMessage(event: InventoryReservedEvent): string {
    return `Your order ${event.orderId} has been confirmed and inventory has been reserved successfully.`;
  }
}
