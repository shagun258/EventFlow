import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import { EventPublisher } from '@eventflow/kafka-events';
import { PrismaService } from './prisma.service';
import { REDIS } from './product.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, @Inject(REDIS) private readonly redis: Redis, private readonly events: EventPublisher) {}
  @Get()
  async check() {
    const checks = { postgres: false, redis: false, kafka: this.events.connected };
    try { await this.prisma.$queryRaw`SELECT 1`; checks.postgres = true; } catch { /* reported below */ }
    try { checks.redis = (await this.redis.ping()) === 'PONG'; } catch { /* reported below */ }
    const body = { status: Object.values(checks).every(Boolean) ? 'ok' : 'error', service: 'product-service', checks };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
