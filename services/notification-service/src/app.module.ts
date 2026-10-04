import { Module } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { HealthController } from './health.controller';
import { NotificationConsumer } from './notification.consumer';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [NotificationController, HealthController],
  providers: [PrismaService, NotificationService, NotificationConsumer,
    { provide: EventPublisher, useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'notification-service'); await p.connect(); return p; } }],
})
export class AppModule {}
