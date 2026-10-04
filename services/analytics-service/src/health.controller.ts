import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AnalyticsConsumer } from './analytics.consumer';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly consumer: AnalyticsConsumer) {}
  @Get()
  async check() {
    const checks = { postgres: false, kafkaConsumer: this.consumer.consumer.connected };
    try { await this.prisma.$queryRaw`SELECT 1`; checks.postgres = true; } catch { /* reported below */ }
    const body = { status: Object.values(checks).every(Boolean) ? 'ok' : 'error', service: 'analytics-service', checks };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
