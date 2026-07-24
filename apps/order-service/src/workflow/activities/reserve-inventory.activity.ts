import type { WorkflowActivityContext } from '@dapr/dapr';
import { HttpMethod } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';
import type {
  InventoryReservedEvent,
  PaymentCompletedEvent,
} from 'dapr-learning/common';

const client = createDaprClient();

export const reserveInventoryActivity = async (
  _ctx: WorkflowActivityContext,
  input: PaymentCompletedEvent,
): Promise<InventoryReservedEvent> => {
  const reservation = (await client.invoker.invoke(
    'inventory-service',
    'inventory/reserve',
    HttpMethod.POST,
    input,
  )) as InventoryReservedEvent;

  return reservation;
};
