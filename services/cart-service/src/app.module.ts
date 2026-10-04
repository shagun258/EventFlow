import { Module } from '@nestjs/common';
import { grpcClient } from '@eventflow/service-common';
import { CartConsumer } from './cart.consumer';
import { CartController } from './cart.controller';
import { CartService, PRODUCT_CLIENT } from './cart.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [CartController, HealthController],
  providers: [PrismaService, CartService, CartConsumer,
    { provide: PRODUCT_CLIENT, useFactory: () => grpcClient('product.proto', 'product', 'ProductService', process.env.PRODUCT_GRPC_URL as string) }],
})
export class AppModule {}
