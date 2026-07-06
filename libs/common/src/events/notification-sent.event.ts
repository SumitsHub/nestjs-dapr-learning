import { NotificationChannel, NotificationStatus } from '../enums';

export class NotificationSentEvent {
  notificationId: string;
  orderId: string;
  reservationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt: Date;
  paymentId: string;
}
