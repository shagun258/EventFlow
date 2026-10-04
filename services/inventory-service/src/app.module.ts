import { Module } from '@nestjs/common';
import { EventPublisher } from '@eventflow/kafka-events';
import { HealthController } from './health.controller';
import { InventoryConsumer } from './inventory.consumer';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [InventoryController, HealthController],
  providers: [PrismaService, InventoryService, InventoryConsumer,
    { provide: EventPublisher, useFactory: async () => { const p = new EventPublisher(process.env.KAFKA_BROKERS as string, 'inventory-service'); await p.connect(); return p; } }],
})
export class AppModule {}
