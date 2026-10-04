import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConsumerGroups, EventConsumer } from '@eventflow/kafka-events';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('InventoryConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, ConsumerGroups.INVENTORY, (m) => this.log.log(m));
  constructor(private readonly inv: InventoryService) {
    this.consumer
      .on('payment.completed', (e) => this.inv.confirm(e))
      .on('payment.failed', (e) => this.inv.release(e.payload.orderId).then(() => undefined))
      .on('order.cancelled', (e) => this.inv.release(e.payload.orderId).then(() => undefined));
  }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
