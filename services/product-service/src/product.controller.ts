import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AdminGuard } from './admin.guard';
import { ProductService } from './product.service';

@Controller()
export class ProductController {
  constructor(private readonly products: ProductService) {}
  @GrpcMethod('ProductService', 'ListProducts') list(d: any) { return this.products.list(d); }
  @GrpcMethod('ProductService', 'GetProduct') get(d: any) { return this.products.get(d); }
  @GrpcMethod('ProductService', 'ListCategories') categories() { return this.products.categories(); }
  @UseGuards(AdminGuard) @GrpcMethod('ProductService', 'CreateProduct') create(d: any) { return this.products.create(d); }
  @UseGuards(AdminGuard) @GrpcMethod('ProductService', 'UpdateProduct') update(d: any) { return this.products.update(d); }
  @UseGuards(AdminGuard) @GrpcMethod('ProductService', 'DeleteProduct') remove(d: any) { return this.products.remove(d); }
}
