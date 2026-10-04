import { Module } from '@nestjs/common';
import { AnalyticsConsumer } from './analytics.consumer';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Module({ controllers: [AnalyticsController, HealthController], providers: [PrismaService, AnalyticsService, AnalyticsConsumer] })
export class AppModule {}
