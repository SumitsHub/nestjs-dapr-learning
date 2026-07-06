import { NotificationChannel, NotificationStatus } from 'dapr-learning/common';

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
