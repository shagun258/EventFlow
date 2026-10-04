import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EventConsumer } from '@eventflow/kafka-events';
import { CartService } from './cart.service';

@Injectable()
export class CartConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('CartConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, 'cart-service', (m) => this.log.log(m));
  constructor(private readonly cart: CartService) { this.consumer.on('order.created', (e) => this.cart.onOrderCreated(e)); }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
