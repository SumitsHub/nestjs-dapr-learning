import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  async send(message: string) {
    console.log('--------------------------------');

    console.log('SMS SENT');

    console.log(message);

    console.log('--------------------------------');
  }
}
