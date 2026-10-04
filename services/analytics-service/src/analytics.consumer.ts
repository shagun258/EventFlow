import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConsumerGroups, EventConsumer, Topics } from '@eventflow/kafka-events';
import { AnalyticsService } from './analytics.service';

/** Subscribes to every domain topic. */
@Injectable()
export class AnalyticsConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('AnalyticsConsumer');
  readonly consumer = new EventConsumer(process.env.KAFKA_BROKERS as string, ConsumerGroups.ANALYTICS, (m) => this.log.log(m));
  constructor(a: AnalyticsService) { for (const t of Object.values(Topics)) this.consumer.on(t, (e: any) => a.record(e)); }
  onApplicationBootstrap() { return this.consumer.start(); }
  onModuleDestroy() { return this.consumer.stop(); }
}
