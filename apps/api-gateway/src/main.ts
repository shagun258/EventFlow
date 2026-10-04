import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  new Logger('ApiGateway').log(`GraphQL on :${port}/graphql, health on :${port}/health`);
}
bootstrap();
