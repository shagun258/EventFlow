import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConsumerGroups, EventConsumer } from '@eventflow/kafka-events';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PaymentConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, ConsumerGroups.PAYMENT, (m) => this.log.log(m));
  constructor(private readonly payments: PaymentService) {
    this.consumer.on('order.created', (e) => this.payments.process(e)).on('order.cancelled', (e) => this.payments.onOrderCancelled(e));
  }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
