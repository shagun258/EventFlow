import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { requireAdmin, requireUser } from '@eventflow/service-common';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}
  @GrpcMethod('OrderService', 'CreateOrder') create(d: any, md: Metadata) { return this.orders.create(requireUser(md), d); }
  @GrpcMethod('OrderService', 'GetOrder') get(d: any, md: Metadata) { return this.orders.get(requireUser(md), d); }
  @GrpcMethod('OrderService', 'ListOrders') list(d: any, md: Metadata) { return this.orders.list(requireUser(md), d); }
  @GrpcMethod('OrderService', 'CancelOrder') cancel(d: any, md: Metadata) { return this.orders.cancel(requireUser(md), d); }
  @GrpcMethod('OrderService', 'UpdateOrderStatus') update(d: any, md: Metadata) { return this.orders.updateStatus(requireAdmin(md), d); }
}
