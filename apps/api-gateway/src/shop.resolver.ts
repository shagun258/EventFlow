import { Inject } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GrpcCaller } from '@eventflow/service-common';
import { Auth } from './guards';
import { CART, GqlCtx, gqlError, NOTIFICATION, ORDER, PRODUCT, rpc } from './infra';
import { Cart, CartItemInput, Category, Notification, NotificationPage, NotificationsArgs, Order, OrderPage, OrdersArgs, Product, ProductPage, ProductsArgs } from './types';

@Resolver()
export class ShopResolver {
  constructor(@Inject(PRODUCT) private readonly product: GrpcCaller, @Inject(CART) private readonly cart: GrpcCaller,
    @Inject(ORDER) private readonly order: GrpcCaller, @Inject(NOTIFICATION) private readonly notif: GrpcCaller) {}

  // ---- catalogue (public) ----
  @Query(() => ProductPage) products(@Args() a: ProductsArgs) { return rpc(this.product, 'listProducts', a); }
  @Query(() => Product, { name: 'product' }) product_(@Args('id', { type: () => ID }) id: string) { return rpc(this.product, 'getProduct', { id }); }
  @Query(() => [Category]) categories() { return rpc(this.product, 'listCategories').then((r) => r.categories); }

  // ---- cart ----
  @Auth() @Query(() => Cart, { name: 'cart' }) cart_(@Context() ctx: GqlCtx) { return rpc(this.cart, 'getCart', {}, ctx.token); }
  @Auth() @Mutation(() => Cart) addToCart(@Args('input') i: CartItemInput, @Context() ctx: GqlCtx) { return rpc(this.cart, 'addToCart', i, ctx.token); }
  @Auth() @Mutation(() => Cart) updateCart(@Args('input') i: CartItemInput, @Context() ctx: GqlCtx) { return rpc(this.cart, 'updateCartItem', i, ctx.token); }
  @Auth() @Mutation(() => Cart) removeFromCart(@Args('productId') productId: string, @Context() ctx: GqlCtx) { return rpc(this.cart, 'removeFromCart', { productId }, ctx.token); }

  // ---- orders ----
  /** Checkout: the order is built from the server-side cart, so the client can never send its own prices or items. */
  @Auth() @Mutation(() => Order)
  async createOrder(@Context() ctx: GqlCtx) {
    const cart = await rpc(this.cart, 'getCart', {}, ctx.token);
    if (!cart.items?.length) throw gqlError('Your cart is empty', 'BAD_USER_INPUT');
    if (cart.items.some((i: any) => i.unavailable)) throw gqlError('Remove unavailable products from your cart first', 'BAD_USER_INPUT');
    return rpc(this.order, 'createOrder', { items: cart.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) }, ctx.token);
  }
  @Auth() @Query(() => OrderPage) orders(@Args() a: OrdersArgs, @Context() ctx: GqlCtx) { return rpc(this.order, 'listOrders', { ...a, all: false }, ctx.token); }
  @Auth() @Query(() => Order, { name: 'order' }) order_(@Args('id', { type: () => ID }) id: string, @Context() ctx: GqlCtx) { return rpc(this.order, 'getOrder', { id }, ctx.token); }
  @Auth() @Mutation(() => Order)
  cancelOrder(@Args('id', { type: () => ID }) id: string, @Args('reason', { nullable: true }) reason: string, @Context() ctx: GqlCtx) { return rpc(this.order, 'cancelOrder', { id, reason }, ctx.token); }

  // ---- notifications ----
  @Auth() @Query(() => NotificationPage) notifications(@Args() a: NotificationsArgs, @Context() ctx: GqlCtx) { return rpc(this.notif, 'listNotifications', a, ctx.token); }
  @Auth() @Mutation(() => Notification) markNotificationRead(@Args('id', { type: () => ID }) id: string, @Context() ctx: GqlCtx) { return rpc(this.notif, 'markRead', { id }, ctx.token); }
}
