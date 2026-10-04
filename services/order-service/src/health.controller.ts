import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { GrpcCaller } from '@eventflow/service-common';
import { OrderConsumer } from './order.consumer';
import { INVENTORY_CLIENT, PAYMENT_CLIENT, PRODUCT_CLIENT } from './order.service';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher, private readonly consumer: OrderConsumer,
    @Inject(PRODUCT_CLIENT) private readonly product: GrpcCaller, @Inject(INVENTORY_CLIENT) private readonly inventory: GrpcCaller,
    @Inject(PAYMENT_CLIENT) private readonly payment: GrpcCaller) {}
  @Get()
  async check() {
    const checks = { postgres: false, kafkaProducer: this.events.connected, kafkaConsumer: this.consumer.consumer.connected };
    try { await this.prisma.$queryRaw`SELECT 1`; checks.postgres = true; } catch { /* reported below */ }
    const [p, i, pay] = await Promise.all([this.product.isReady(), this.inventory.isReady(), this.payment.isReady()]);
    const dependencies = { productService: p, inventoryService: i, paymentService: pay };
    const healthy = Object.values(checks).every(Boolean);
    const body = { status: !healthy ? 'error' : Object.values(dependencies).every(Boolean) ? 'ok' : 'degraded', service: 'order-service', checks, dependencies };
    if (!healthy) throw new ServiceUnavailableException(body);
    return body; // 'degraded' = own infra fine but a gRPC dependency is down (still HTTP 200 so it stays running)
  }
}
