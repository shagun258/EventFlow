import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { NotificationConsumer } from './notification.consumer';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher, private readonly consumer: NotificationConsumer) {}
  @Get()
  async check() {
    const checks = { postgres: false, kafkaProducer: this.events.connected, kafkaConsumer: this.consumer.consumer.connected };
    try { await this.prisma.$queryRaw`SELECT 1`; checks.postgres = true; } catch { /* reported below */ }
    const body = { status: Object.values(checks).every(Boolean) ? 'ok' : 'error', service: 'notification-service', checks };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
