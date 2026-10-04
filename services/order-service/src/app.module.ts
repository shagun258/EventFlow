import { Module } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { grpcClient } from '@eventflow/service-common';
import { HealthController } from './health.controller';
import { OrderConsumer } from './order.consumer';
import { OrderController } from './order.controller';
import { INVENTORY_CLIENT, OrderService, PAYMENT_CLIENT, PRODUCT_CLIENT } from './order.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [OrderController, HealthController],
  providers: [PrismaService, OrderService, OrderConsumer,
    { provide: PRODUCT_CLIENT, useFactory: () => grpcClient('product.proto', 'product', 'ProductService', process.env.PRODUCT_GRPC_URL as string) },
    { provide: INVENTORY_CLIENT, useFactory: () => grpcClient('inventory.proto', 'inventory', 'InventoryService', process.env.GRPC_INVENTORY_URL as string) },
    { provide: PAYMENT_CLIENT, useFactory: () => grpcClient('payment.proto', 'payment', 'PaymentService', process.env.GRPC_PAYMENT_URL as string) },
    { provide: EventPublisher, useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'order-service'); await p.connect(); return p; } }],
})
export class AppModule {}
