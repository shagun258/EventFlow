import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConsumerGroups, EventConsumer } from '@eventflow/kafka-events';
import { OrderService } from './order.service';

@Injectable()
export class OrderConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('OrderConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, ConsumerGroups.ORDER, (m) => this.log.log(m));
  constructor(private readonly orders: OrderService) {
    this.consumer.on('payment.completed', (e) => this.orders.onPaymentCompleted(e)).on('payment.failed', (e) => this.orders.onPaymentFailed(e));
  }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
