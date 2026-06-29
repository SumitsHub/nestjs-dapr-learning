import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDto } from 'dapr-learning/common';
import { DaprService } from './dapr.service';

@Injectable()
export class OrderServiceService {
  constructor(
    private readonly httpService: HttpService,
    private readonly daprService: DaprService,
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

    await this.daprService.publishOrderCreated({
      orderId: payload.orderId,
      amount: payload.amount,
    });
    return {
      orderCreated: true,
      eventPublished: true,
    };
  }
}
