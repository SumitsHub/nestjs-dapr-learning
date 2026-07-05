import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import {
  CreateOrderDto,
  OrderCreatedEvent,
  OrderStatus,
  TOPICS,
} from 'dapr-learning/common';
import { StateService } from './state.service';
import { PubSubService } from '@app/dapr-core';

@Injectable()
export class OrderServiceService {
  constructor(
    private readonly httpService: HttpService,
    private readonly pubSubService: PubSubService,
    private readonly stateService: StateService,
  ) {}

  async createOrder(payload: CreateOrderDto) {
    // const response = await firstValueFrom(
    //   this.httpService.post(
    //     'http://localhost:3500/v1.0/invoke/payment-service/method/payments',
    //     {
    //       orderId: payload.orderId,
    //       amount: payload.amount,
    //     },
    //   ),
    // );

    // Save the order to state store (Dapr state management)
    await this.stateService.saveOrder({
      orderId: payload.orderId,
      amount: payload.amount,
      status: OrderStatus.CREATED,
      createdAt: new Date().toISOString(),
    });

    const event: OrderCreatedEvent = {
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

    await this.pubSubService.publish(TOPICS.ORDER_CREATED, event);
    return {
      orderCreated: true,
      eventPublished: true,
    };
  }

  async getOrder(orderId: string) {
    return this.stateService.getOrder(orderId);
  }
}
