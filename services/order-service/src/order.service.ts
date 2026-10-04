import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventEnvelope, EventPublisher, Topics } from '@eventflow/kafka-events';
import { AuthUser, GrpcCaller, rpcError, status } from '@eventflow/service-common';
import { PrismaService } from './prisma.service';

export const PRODUCT_CLIENT = 'PRODUCT_CLIENT', INVENTORY_CLIENT = 'INVENTORY_CLIENT', PAYMENT_CLIENT = 'PAYMENT_CLIENT';
const STATUSES = ['PENDING', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'REJECTED', 'SHIPPED', 'DELIVERED'] as const;
/** Admin fulfilment transitions: target status -> required current status. */
const FULFILMENT: Record<string, 'PAID' | 'SHIPPED'> = { SHIPPED: 'PAID', DELIVERED: 'SHIPPED' };

/**
 * Order workflow (see README): validate -> price from product-service (gRPC) -> save PENDING ->
 * reserve stock (gRPC) -> create payment record (gRPC) -> publish order.created (Kafka).
 * Any failure after the reservation compensates by releasing stock and marking the order REJECTED.
 */
@Injectable()
export class OrderService {
  private readonly log = new Logger('OrderService');
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher,
    @Inject(PRODUCT_CLIENT) private readonly product: GrpcCaller, @Inject(INVENTORY_CLIENT) private readonly inventory: GrpcCaller,
    @Inject(PAYMENT_CLIENT) private readonly payment: GrpcCaller) {}

  async create(user: AuthUser, req: { items: { productId: string; quantity: number }[] }) {
    const items = this.normalize(req?.items);
    const products = await Promise.all(items.map((i) => this.product.call('getProduct', { id: i.productId }).catch((e) => {
      throw e.code === status.NOT_FOUND ? rpcError(status.NOT_FOUND, `Product ${i.productId} not found`) : rpcError(status.UNAVAILABLE, 'Product service unavailable');
    })));
    // Prices come from product-service, never from the client.
    const lines = items.map((i, n) => ({ productId: i.productId, productName: products[n].name as string, unitPrice: products[n].price as number, quantity: i.quantity }));
    const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;
    const order = await this.prisma.order.create({
      data: { orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`, userId: user.id, total, items: { create: lines } }, include: { items: true } });
    this.log.log(`Order created: ${order.orderNumber}`);

    const reject = async (reason: string, code: number): Promise<never> => {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'REJECTED', failureReason: reason } });
      this.log.warn(`Order ${order.orderNumber} rejected: ${reason}`);
      throw rpcError(code, reason);
    };
    let reserved;
    try { reserved = await this.inventory.call('reserveStock', { orderId: order.id, items }); }
    catch { return reject('Inventory service unavailable', status.UNAVAILABLE); }
    if (!reserved.success) return reject(reserved.message || 'Insufficient stock', status.FAILED_PRECONDITION);

    try { await this.payment.call('createPayment', { orderId: order.id, userId: user.id, amount: total }); }
    catch { await this.releaseQuietly(order.id); return reject('Payment service unavailable', status.UNAVAILABLE); }

    try { await this.events.publish(Topics.ORDER_CREATED, order.id, { orderId: order.id, userId: user.id, items: lines, total }); }
    catch { await this.releaseQuietly(order.id); return reject('Messaging unavailable, please retry', status.UNAVAILABLE); }
    return this.toDto(order);
  }

  async get(user: AuthUser, { id }: { id: string }) {
    const order = await this.prisma.order.findFirst({ where: { id, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) }, include: { items: true } });
    if (!order) throw rpcError(status.NOT_FOUND, 'Order not found');
    const paymentStatus = await this.payment.call('getPaymentStatus', { orderId: id }).then((p) => p.status as string).catch(() => '');
    return this.toDto(order, paymentStatus);
  }

  async list(user: AuthUser, q: { all?: boolean; status?: string; page?: number; pageSize?: number }) {
    if (q.all && user.role !== 'ADMIN') throw rpcError(status.PERMISSION_DENIED, 'Admin access required');
    if (q.status && !(STATUSES as readonly string[]).includes(q.status)) throw rpcError(status.INVALID_ARGUMENT, 'Unknown status filter');
    const take = Math.min(100, Math.max(1, q.pageSize || 20)); const skip = (Math.max(1, q.page || 1) - 1) * take;
    const where = { ...(q.all ? {} : { userId: user.id }), ...(q.status ? { status: q.status as (typeof STATUSES)[number] } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.order.count({ where })]);
    return { orders: rows.map((o: any) => this.toDto(o)), total };
  }

  async cancel(user: AuthUser, { id, reason }: { id: string; reason?: string }) {
    const scope = user.role === 'ADMIN' ? { id } : { id, userId: user.id };
    const res = await this.prisma.order.updateMany({ where: { ...scope, status: { in: ['PENDING', 'PAID'] } }, data: { status: 'CANCELLED', failureReason: reason || 'Cancelled by user' } });
    if (res.count === 0) {
      const o = await this.prisma.order.findFirst({ where: scope });
      if (!o) throw rpcError(status.NOT_FOUND, 'Order not found');
      throw rpcError(status.FAILED_PRECONDITION, `Order cannot be cancelled in status ${o.status}`);
    }
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    this.log.log(`Order cancelled: ${order!.orderNumber}`);
    await this.events.publish(Topics.ORDER_CANCELLED, id, { orderId: id, userId: order!.userId, reason })
      .catch((e) => this.log.error(`Failed to publish order.cancelled for ${id}: ${e.message}`));
    return this.toDto(order!);
  }

  async updateStatus(_admin: AuthUser, { id, status: to }: { id: string; status: string }) {
    const from = FULFILMENT[to];
    if (!from) throw rpcError(status.INVALID_ARGUMENT, 'Status must be SHIPPED or DELIVERED');
    const res = await this.prisma.order.updateMany({ where: { id, status: from }, data: { status: to as 'SHIPPED' | 'DELIVERED' } });
    if (res.count === 0) {
      const o = await this.prisma.order.findUnique({ where: { id } });
      if (!o) throw rpcError(status.NOT_FOUND, 'Order not found');
      throw rpcError(status.FAILED_PRECONDITION, `Cannot move ${o.status} order to ${to}`);
    }
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    await this.events.publish(Topics.ORDER_STATUS_UPDATED, id, { orderId: id, userId: order!.userId, status: to })
      .catch((e) => this.log.error(`Failed to publish order.status_updated: ${e.message}`));
    return this.toDto(order!);
  }

  // ---- Kafka handlers (idempotent: conditional updates only touch PENDING orders) ----
  async onPaymentCompleted(e: EventEnvelope<'payment.completed'>) { await this.settle(e.payload.orderId, e.payload.userId, 'PAID'); }
  async onPaymentFailed(e: EventEnvelope<'payment.failed'>) { await this.settle(e.payload.orderId, e.payload.userId, 'PAYMENT_FAILED', e.payload.reason); }

  private async settle(orderId: string, userId: string, to: 'PAID' | 'PAYMENT_FAILED', reason?: string) {
    const res = await this.prisma.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: to, ...(reason ? { failureReason: reason } : {}) } });
    if (res.count === 0) return void this.log.warn(`Ignored ${to} for order ${orderId}: not PENDING (cancelled or already settled)`);
    this.log.log(`Order ${orderId} -> ${to}`);
    await this.events.publish(Topics.ORDER_STATUS_UPDATED, orderId, { orderId, userId, status: to });
  }

  private async releaseQuietly(orderId: string) {
    await this.inventory.call('releaseStock', { orderId }).catch((e) => this.log.error(`Compensation failed for ${orderId}: ${e.message}`));
  }
  private normalize(items: { productId: string; quantity: number }[] = []) {
    if (!items.length || items.length > 50) throw rpcError(status.INVALID_ARGUMENT, 'Order must contain 1-50 items');
    const m = new Map<string, number>();
    for (const i of items) {
      if (!i.productId || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100) throw rpcError(status.INVALID_ARGUMENT, 'Each item needs a productId and quantity 1-100');
      m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    }
    return [...m].map(([productId, quantity]) => ({ productId, quantity }));
  }
  private toDto = (o: any, paymentStatus = '') => ({ id: o.id, orderNumber: o.orderNumber, userId: o.userId, status: o.status as string, total: Number(o.total),
    failureReason: o.failureReason ?? '', paymentStatus, createdAt: new Date(o.createdAt).toISOString(), updatedAt: new Date(o.updatedAt).toISOString(),
    items: (o.items ?? []).map((i: any) => ({ productId: i.productId, productName: i.productName, unitPrice: Number(i.unitPrice), quantity: i.quantity })) });
}
