import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { requireUser } from '@eventflow/service-common';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly n: NotificationService) {}
  @GrpcMethod('NotificationService', 'ListNotifications') list(d: any, md: Metadata) { return this.n.list(requireUser(md), d); }
  @GrpcMethod('NotificationService', 'MarkRead') markRead(d: any, md: Metadata) { return this.n.markRead(requireUser(md), d); }
}
