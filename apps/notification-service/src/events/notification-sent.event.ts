import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

export class NotificationSentEvent {
  notificationId: string;

  orderId: string;

  reservationId: string;

  channel: NotificationChannel;

  status: NotificationStatus;

  sentAt: Date;

  paymentId: string;
}
