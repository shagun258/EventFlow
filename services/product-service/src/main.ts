import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const grpcPort = process.env.GRPC_PORT ?? 50062;
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.GRPC, options: {
    package: 'product', url: `0.0.0.0:${grpcPort}`,
    protoPath: join(process.env.PROTO_DIR ?? join(__dirname, '../../../packages/proto'), 'product.proto'),
  } });
  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(process.env.HTTP_PORT ?? 3002, '0.0.0.0');
  new Logger('ProductService').log(`gRPC on :${grpcPort}, health on :${process.env.HTTP_PORT ?? 3002}`);
}
bootstrap();
