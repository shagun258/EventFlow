import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { EventPublisher } from '@eventflow/kafka-events';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { ProductController } from './product.controller';
import { ProductService, REDIS } from './product.service';

@Module({
  controllers: [ProductController, HealthController],
  providers: [PrismaService, ProductService,
    { provide: REDIS, useFactory: () => new Redis(process.env.REDIS_URL as string) },
    { provide: EventPublisher, useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'product-service'); await p.connect(); return p; } }],
})
export class AppModule {}
