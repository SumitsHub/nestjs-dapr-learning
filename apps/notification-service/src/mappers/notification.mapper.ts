import { NotificationDto } from '../dtos/notification.dto';
import { NotificationSentEvent } from '../events/notification-sent.event';

export class NotificationMapper {
  static toNotificationSentEvent(
    notificationDto: NotificationDto,
  ): NotificationSentEvent {
    const notificationSentEvent = new NotificationSentEvent();
    notificationSentEvent.notificationId = notificationDto.notificationId;
    notificationSentEvent.orderId = notificationDto.orderId;
    notificationSentEvent.reservationId = notificationDto.reservationId;
    notificationSentEvent.channel = notificationDto.channel;
    notificationSentEvent.status = notificationDto.status;
    notificationSentEvent.sentAt = notificationDto.sentAt;
    notificationSentEvent.paymentId = notificationDto.paymentId;
    return notificationSentEvent;
  }
}
