import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import Redis from 'ioredis';
import { grpcClient } from '@eventflow/service-common';
import { AdminResolver } from './admin.resolver';
import { AuthResolver } from './auth.resolver';
import { RateLimitGuard } from './guards';
import { HealthController } from './health.controller';
import { ANALYTICS, AUTH, CART, INVENTORY, NOTIFICATION, ORDER, PRODUCT, REDIS } from './infra';
import { ShopResolver } from './shop.resolver';

const client = (token: string, file: string, pkg: string, service: string, env: string) =>
  ({ provide: token, useFactory: () => grpcClient(file, pkg, service, process.env[env] as string) });

@Module({
  imports: [GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver, autoSchemaFile: true, sortSchema: true,
    context: ({ req }: { req: unknown }) => ({ req }),
    introspection: process.env.NODE_ENV !== 'production', includeStacktraceInErrorResponses: false,
  })],
  controllers: [HealthController],
  providers: [AuthResolver, ShopResolver, AdminResolver, { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: REDIS, useFactory: () => new Redis(process.env.REDIS_URL as string) },
    client(AUTH, 'auth.proto', 'auth', 'AuthService', 'AUTH_GRPC_URL'), client(PRODUCT, 'product.proto', 'product', 'ProductService', 'PRODUCT_GRPC_URL'),
    client(CART, 'cart.proto', 'cart', 'CartService', 'CART_GRPC_URL'), client(ORDER, 'order.proto', 'order', 'OrderService', 'ORDER_GRPC_URL'),
    client(INVENTORY, 'inventory.proto', 'inventory', 'InventoryService', 'GRPC_INVENTORY_URL'),
    client(NOTIFICATION, 'notification.proto', 'notification', 'NotificationService', 'NOTIFICATION_GRPC_URL'),
    client(ANALYTICS, 'analytics.proto', 'analytics', 'AnalyticsService', 'ANALYTICS_GRPC_URL')],
})
export class AppModule {}
