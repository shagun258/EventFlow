import { Controller, Get, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { GrpcCaller } from '@eventflow/service-common';
import { ANALYTICS, AUTH, CART, INVENTORY, NOTIFICATION, ORDER, PRODUCT, REDIS } from './infra';

@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS) private readonly redis: Redis, @Inject(AUTH) private readonly auth: GrpcCaller, @Inject(PRODUCT) private readonly product: GrpcCaller,
    @Inject(CART) private readonly cart: GrpcCaller, @Inject(ORDER) private readonly order: GrpcCaller, @Inject(INVENTORY) private readonly inventory: GrpcCaller,
    @Inject(NOTIFICATION) private readonly notification: GrpcCaller, @Inject(ANALYTICS) private readonly analytics: GrpcCaller) {}
  /** 200 = gateway is up. `degraded` lists downstream gRPC services that are unreachable. */
  @Get()
  async check() {
    const redis = await this.redis.ping().then((r) => r === 'PONG').catch(() => false);
    const names = ['auth', 'product', 'cart', 'order', 'inventory', 'notification', 'analytics'] as const;
    const ready = await Promise.all(names.map((n) => this[n].isReady()));
    const dependencies = Object.fromEntries(names.map((n, i) => [`${n}Service`, ready[i]]));
    return { status: redis && ready.every(Boolean) ? 'ok' : 'degraded', service: 'api-gateway', checks: { redis }, dependencies };
  }
}
