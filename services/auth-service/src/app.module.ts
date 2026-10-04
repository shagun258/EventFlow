import { Module } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [AuthController, HealthController],
  providers: [PrismaService, AuthService, {
    provide: EventPublisher,
    useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'auth-service'); await p.connect(); return p; },
  }],
})
export class AppModule {}
