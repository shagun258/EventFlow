import { Module } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { HealthController } from './health.controller';
import { PaymentConsumer } from './payment.consumer';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [PaymentController, HealthController],
  providers: [PrismaService, PaymentService, PaymentConsumer,
    { provide: EventPublisher, useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'payment-service'); await p.connect(); return p; } }],
})
export class AppModule {}
