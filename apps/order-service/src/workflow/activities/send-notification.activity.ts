import type { WorkflowActivityContext } from '@dapr/dapr';
import { HttpMethod } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';
import type { InventoryReservedEvent } from 'dapr-learning/common';

const client = createDaprClient();

export const sendNotificationActivity = async (
  _ctx: WorkflowActivityContext,
  input: InventoryReservedEvent,
): Promise<{ notificationId: string; orderId: string }> => {
  const notification = (await client.invoker.invoke(
    'notification-service',
    'notifications/send',
    HttpMethod.POST,
    input,
  )) as { notificationId: string; orderId: string };

  return notification;
};
