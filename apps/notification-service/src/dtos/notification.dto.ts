import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

export class NotificationDto {
  notificationId: string;

  orderId: string;

  paymentId: string;

  reservationId: string;

  message: string;

  sentAt: Date;

  channel: NotificationChannel;

  status: NotificationStatus;
}
