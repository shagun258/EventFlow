import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEnvelope } from '@eventflow/kafka-events';
import { AuthUser, GrpcCaller, rpcError, status } from '@eventflow/service-common';
import { PrismaService } from './prisma.service';

export const PRODUCT_CLIENT = 'PRODUCT_CLIENT';
const MAX_QTY = 100;
const round = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CartService {
  private readonly log = new Logger('CartService');
  constructor(private readonly prisma: PrismaService, @Inject(PRODUCT_CLIENT) private readonly product: GrpcCaller) {}

  async get(user: AuthUser) {
    const cart = await this.prisma.cart.findUnique({ where: { userId: user.id }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    const items = await Promise.all((cart?.items ?? []).map(async (i: any) => {
      try {
        const p = await this.product.call('getProduct', { id: i.productId });
        return { productId: i.productId, productName: p.name as string, unitPrice: p.price as number, quantity: i.quantity as number, lineTotal: round(p.price * i.quantity), unavailable: false };
      } catch (e: any) {
        if (e.code === status.NOT_FOUND) return { productId: i.productId, productName: 'Unavailable product', unitPrice: 0, quantity: i.quantity as number, lineTotal: 0, unavailable: true };
        throw rpcError(status.UNAVAILABLE, 'Product service unavailable');
      }
    }));
    const live = items.filter((i) => !i.unavailable);
    return { items, total: round(live.reduce((s, i) => s + i.lineTotal, 0)), itemCount: live.reduce((s, i) => s + i.quantity, 0) };
  }

  async add(user: AuthUser, { productId, quantity }: { productId: string; quantity: number }) {
    this.checkQty(quantity);
    await this.product.call('getProduct', { id: productId }).catch((e: any) => {
      throw e.code === status.NOT_FOUND ? rpcError(status.NOT_FOUND, 'Product not found') : rpcError(status.UNAVAILABLE, 'Product service unavailable');
    });
    const cart = await this.prisma.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
    if (existing) {
      if (existing.quantity + quantity > MAX_QTY) throw rpcError(status.INVALID_ARGUMENT, `Maximum ${MAX_QTY} units per product`);
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: quantity } } });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
    }
    this.log.log(`Cart updated for user ${user.id}: +${quantity} of ${productId}`);
    return this.get(user);
  }

  async update(user: AuthUser, { productId, quantity }: { productId: string; quantity: number }) {
    this.checkQty(quantity);
    const res = await this.prisma.cartItem.updateMany({ where: { productId, cart: { userId: user.id } }, data: { quantity } });
    if (res.count === 0) throw rpcError(status.NOT_FOUND, 'Item not in cart');
    return this.get(user);
  }

  async remove(user: AuthUser, { productId }: { productId: string }) {
    await this.prisma.cartItem.deleteMany({ where: { productId, cart: { userId: user.id } } }); // idempotent
    return this.get(user);
  }

  /** order.created -> remove exactly the ordered products (items added after checkout are kept). Naturally idempotent. */
  async onOrderCreated(e: EventEnvelope<'order.created'>) {
    const { userId, items } = e.payload;
    const res = await this.prisma.cartItem.deleteMany({ where: { cart: { userId }, productId: { in: items.map((i) => i.productId) } } });
    this.log.log(`Cart cleared for user ${userId} after order ${e.payload.orderId} (${res.count} line(s))`);
  }

  private checkQty(q: number) {
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) throw rpcError(status.INVALID_ARGUMENT, `Quantity must be 1-${MAX_QTY}`);
  }
}
