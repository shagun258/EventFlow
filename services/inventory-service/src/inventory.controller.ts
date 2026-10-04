import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { requireAdmin } from '@eventflow/service-common';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inv: InventoryService) {}
  @GrpcMethod('InventoryService', 'CheckStock') check(d: any) { return this.inv.checkStock(d); }
  @GrpcMethod('InventoryService', 'ReserveStock') reserve(d: any) { return this.inv.reserveStock(d); }
  @GrpcMethod('InventoryService', 'ReleaseStock') release(d: any) { return this.inv.release(d.orderId); }
  @GrpcMethod('InventoryService', 'ListInventory') list(d: any, md: Metadata) { requireAdmin(md); return this.inv.list(d); }
  @GrpcMethod('InventoryService', 'UpdateInventory') update(d: any, md: Metadata) { requireAdmin(md); return this.inv.update(d); }
}
