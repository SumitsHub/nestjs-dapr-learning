import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async send(message: string) {
    console.log('--------------------------------');

    console.log('EMAIL SENT');

    console.log(message);

    console.log('--------------------------------');
  }
}
