import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { requireAdmin } from '@eventflow/service-common';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly a: AnalyticsService) {}
  @GrpcMethod('AnalyticsService', 'GetAnalytics') summary(_d: any, md: Metadata) { requireAdmin(md); return this.a.summary(); }
  @GrpcMethod('AnalyticsService', 'ListEvents') list(d: any, md: Metadata) { requireAdmin(md); return this.a.listEvents(d); }
}
