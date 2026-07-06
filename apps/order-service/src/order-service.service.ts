import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import {
  CreateOrderDto,
  OrderCreatedEvent,
  OrderStatus,
} from 'dapr-learning/common';
import { StateService } from './state.service';

@Injectable()
export class OrderServiceService {
  constructor(
    private readonly httpService: HttpService,
    private readonly stateService: StateService,
  ) {}

  async createOrder(payload: CreateOrderDto) {
    // Lesson 15 — Transactional Outbox
    //
    // Before: we called saveOrder() and THEN publish(). Two operations,
    // no atomicity. A crash between them lost the event permanently.
    //
    // Now: `orderstore` has outbox metadata (see dapr/components/orderstore.yaml).
    // The sidecar publishes to TOPICS.ORDER_CREATED as part of the same
    // transaction that saves the state. Application code makes ONE call.
    //
    // The stored value IS the OrderCreatedEvent — Dapr forwards it verbatim
    // to subscribers, so the stored shape must match the event contract.
    const order: OrderCreatedEvent = {
      orderId: payload.orderId,
      amount: payload.amount,
      status: OrderStatus.CREATED,
      createdAt: new Date(),
      items: [
        {
          quantity: 2,
          sku: 'SKU-123',
        },
      ],
    };

    await this.stateService.saveOrder(order);

    // -----------------------------------------------------------------
    // PREVIOUS DUAL-WRITE (kept for reference — Lessons 6 through 12).
    // Replaced by the outbox above.
    //
    //   await this.stateService.saveOrder({
    //     orderId: payload.orderId,
    //     amount: payload.amount,
    //     status: OrderStatus.CREATED,
    //     createdAt: new Date().toISOString(),
    //   });
    //
    //   const event: OrderCreatedEvent = {
    //     orderId: payload.orderId,
    //     amount: payload.amount,
    //     status: OrderStatus.CREATED,
    //     createdAt: new Date(),
    //     items: [{ quantity: 2, sku: 'SKU-123' }],
    //   };
    //   await this.pubSubService.publish(TOPICS.ORDER_CREATED, event);
    //
    // The gap between saveOrder() and publish() is the dual-write
    // window. A process crash or a broker outage between them
    // permanently loses the OrderCreated event while the order sits
    // silently in the DB. That is the bug the outbox pattern fixes.
    // -----------------------------------------------------------------

    return {
      orderCreated: true,
      eventPublished: true, // published transactionally by the sidecar
    };
  }

  async getOrder(orderId: string) {
    return this.stateService.getOrder(orderId);
  }
}
