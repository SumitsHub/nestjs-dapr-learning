import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';
import type { OrderCreatedEvent } from 'dapr-learning/common';

@Injectable()
export class StateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async saveOrder(order: OrderCreatedEvent) {
    // Lesson 15 note — MUST use the transactional API for outbox to fire.
    //
    // Dapr's Outbox pattern hooks the state store's transactional
    // operation. `client.state.save()` calls the plain bulk-save
    // endpoint (`POST /v1.0/state/{store}`), which writes the state
    // but does NOT trigger outbox. `client.state.transaction()` calls
    // `POST /v1.0/state/{store}/transaction`, which is what the
    // outbox mechanism is wired into.
    //
    // If you switch this back to `.save()`, the order will still be
    // persisted to Redis, but no `order-created` event will ever be
    // published — a very subtle bug.
    await this.client.state.transaction('orderstore', [
      {
        operation: 'upsert',
        request: {
          key: order.orderId,
          value: order,
        },
      },
    ]);
  }

  async getOrder(orderId: string) {
    return this.client.state.get('orderstore', orderId);
  }
}
