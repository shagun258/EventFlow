import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}
  @GrpcMethod('PaymentService', 'CreatePayment') create(d: any) { return this.payments.createPayment(d); }
  @GrpcMethod('PaymentService', 'GetPaymentStatus') get(d: any) { return this.payments.getPaymentStatus(d); }
}
