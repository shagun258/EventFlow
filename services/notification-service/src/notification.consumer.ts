import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConsumerGroups, EventConsumer } from '@eventflow/kafka-events';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('NotificationConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, ConsumerGroups.NOTIFICATION, (m) => this.log.log(m));
  constructor(n: NotificationService) {
    this.consumer.on('user.created', n.onUserCreated).on('order.created', n.onOrderCreated).on('order.cancelled', n.onOrderCancelled)
      .on('payment.failed', n.onPaymentFailed).on('order.status_updated', (e) => n.onOrderStatus(e));
  }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
