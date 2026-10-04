import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { requireUser } from '@eventflow/service-common';
import { CartService } from './cart.service';

@Controller()
export class CartController {
  constructor(private readonly cart: CartService) {}
  @GrpcMethod('CartService', 'GetCart') get(_d: any, md: Metadata) { return this.cart.get(requireUser(md)); }
  @GrpcMethod('CartService', 'AddToCart') add(d: any, md: Metadata) { return this.cart.add(requireUser(md), d); }
  @GrpcMethod('CartService', 'UpdateCartItem') update(d: any, md: Metadata) { return this.cart.update(requireUser(md), d); }
  @GrpcMethod('CartService', 'RemoveFromCart') remove(d: any, md: Metadata) { return this.cart.remove(requireUser(md), d); }
}
