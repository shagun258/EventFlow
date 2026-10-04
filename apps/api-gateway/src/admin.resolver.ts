import { Inject } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GrpcCaller } from '@eventflow/service-common';
import { Admin } from './guards';
import { ANALYTICS, GqlCtx, INVENTORY, ORDER, PRODUCT, rpc } from './infra';
import { Analytics, EventPage, EventsArgs, InventoryItem, InventoryPage, Order, OrderPage, OrdersArgs, PageArgs, Product, ProductInput, ProductPage, ProductsArgs, UpdateInventoryInput } from './types';

/** Every operation here requires an ADMIN JWT at the gateway, and the downstream services re-check the role themselves. */
@Resolver()
export class AdminResolver {
  constructor(@Inject(PRODUCT) private readonly product: GrpcCaller, @Inject(ORDER) private readonly order: GrpcCaller,
    @Inject(INVENTORY) private readonly inventory: GrpcCaller, @Inject(ANALYTICS) private readonly analytics: GrpcCaller) {}

  @Admin() @Query(() => ProductPage) adminProducts(@Args() a: ProductsArgs, @Context() ctx: GqlCtx) { return rpc(this.product, 'listProducts', a, ctx.token); }
  @Admin() @Mutation(() => Product) createProduct(@Args('input') i: ProductInput, @Context() ctx: GqlCtx) { return rpc(this.product, 'createProduct', i, ctx.token); }
  @Admin() @Mutation(() => Product)
  updateProduct(@Args('id', { type: () => ID }) id: string, @Args('input') i: ProductInput, @Context() ctx: GqlCtx) { return rpc(this.product, 'updateProduct', { id, data: i }, ctx.token); }
  @Admin() @Mutation(() => Boolean)
  async deleteProduct(@Args('id', { type: () => ID }) id: string, @Context() ctx: GqlCtx) { await rpc(this.product, 'deleteProduct', { id }, ctx.token); return true; }

  @Admin() @Query(() => InventoryPage, { name: 'inventory' }) inventory_(@Args() a: PageArgs, @Context() ctx: GqlCtx) { return rpc(this.inventory, 'listInventory', a, ctx.token); }
  @Admin() @Mutation(() => InventoryItem) updateInventory(@Args('input') i: UpdateInventoryInput, @Context() ctx: GqlCtx) { return rpc(this.inventory, 'updateInventory', i, ctx.token); }

  @Admin() @Query(() => OrderPage) adminOrders(@Args() a: OrdersArgs, @Context() ctx: GqlCtx) { return rpc(this.order, 'listOrders', { ...a, all: true }, ctx.token); }
  @Admin() @Mutation(() => Order)
  updateOrderStatus(@Args('id', { type: () => ID }) id: string, @Args('status') status: string, @Context() ctx: GqlCtx) { return rpc(this.order, 'updateOrderStatus', { id, status }, ctx.token); }

  @Admin() @Query(() => Analytics, { name: 'analytics' }) analytics_(@Context() ctx: GqlCtx) { return rpc(this.analytics, 'getAnalytics', {}, ctx.token); }
  @Admin() @Query(() => EventPage) events(@Args() a: EventsArgs, @Context() ctx: GqlCtx) { return rpc(this.analytics, 'listEvents', a, ctx.token); }
}
