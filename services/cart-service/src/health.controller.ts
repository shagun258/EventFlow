import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { GrpcCaller } from '@eventflow/service-common';
import { CartConsumer } from './cart.consumer';
import { PRODUCT_CLIENT } from './cart.service';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly consumer: CartConsumer, @Inject(PRODUCT_CLIENT) private readonly product: GrpcCaller) {}
  @Get()
  async check() {
    const checks = { postgres: false, kafkaConsumer: this.consumer.consumer.connected };
    try { await this.prisma.$queryRaw`SELECT 1`; checks.postgres = true; } catch { /* reported below */ }
    const dependencies = { productService: await this.product.isReady() };
    const healthy = Object.values(checks).every(Boolean);
    const body = { status: !healthy ? 'error' : dependencies.productService ? 'ok' : 'degraded', service: 'cart-service', checks, dependencies };
    if (!healthy) throw new ServiceUnavailableException(body);
    return body;
  }
}
