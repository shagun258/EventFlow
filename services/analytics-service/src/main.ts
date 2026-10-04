import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { grpcServerOptions } from '@eventflow/service-common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const grpcPort = process.env.GRPC_PORT ?? 50056;
  const httpPort = process.env.HTTP_PORT ?? 3008;
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.GRPC, options: grpcServerOptions('analytics', 'analytics.proto', grpcPort) });
  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(httpPort, '0.0.0.0');
  new Logger('analytics-service').log(`gRPC on :${grpcPort}, health on :${httpPort}`);
}
bootstrap();
