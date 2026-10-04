import { Injectable, Logger } from '@nestjs/common';
import { EventEnvelope, EventPublisher, Topics } from '@eventflow/kafka-events';
import { AuthUser, isPrismaCode, rpcError, status } from '@eventflow/service-common';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationService {
  private readonly log = new Logger('NotificationService');
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher) {}

  // ---- Kafka handlers ----
  onUserCreated = (e: EventEnvelope<'user.created'>) => this.notify(e.eventId, e.payload.userId, 'WELCOME', `Welcome to EventFlow Commerce! Your account (${e.payload.email}) is ready.`);
  onOrderCreated = (e: EventEnvelope<'order.created'>) => this.notify(e.eventId, e.payload.userId, 'ORDER_PLACED', `Order placed: total $${e.payload.total.toFixed(2)}. Waiting for payment confirmation.`, e.payload.orderId);
  onOrderCancelled = (e: EventEnvelope<'order.cancelled'>) => this.notify(e.eventId, e.payload.userId, 'ORDER_CANCELLED', 'Your order was cancelled.', e.payload.orderId);
  onPaymentFailed = (e: EventEnvelope<'payment.failed'>) => this.notify(e.eventId, e.payload.userId, 'PAYMENT_FAILED', `Payment failed: ${e.payload.reason}. Reserved items were released.`, e.payload.orderId);
  onOrderStatus(e: EventEnvelope<'order.status_updated'>) {
    const msg: Record<string, [string, string]> = {
      PAID: ['ORDER_PAID', 'Payment received. Your order is confirmed!'], SHIPPED: ['ORDER_SHIPPED', 'Your order has shipped.'], DELIVERED: ['ORDER_DELIVERED', 'Your order was delivered.'] };
    const m = msg[e.payload.status]; // PAYMENT_FAILED is covered by payment.failed (has the reason)
    return m ? this.notify(e.eventId, e.payload.userId, m[0], m[1], e.payload.orderId) : Promise.resolve();
  }

  async notify(eventId: string, userId: string, type: string, message: string, orderId?: string) {
    try { await this.prisma.notification.create({ data: { eventId, userId, type, message, orderId } }); }
    catch (e) { if (isPrismaCode(e, 'P2002')) return; throw e; } // duplicate delivery
    this.log.log(`Notification ${type} for user ${userId}`);
    await this.events.publish(Topics.NOTIFICATION_CREATED, userId, { userId, message }).catch((e) => this.log.error(`Failed to publish notification.created: ${e.message}`));
  }

  // ---- gRPC ----
  async list(user: AuthUser, q: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
    const take = Math.min(100, Math.max(1, q.pageSize || 20)); const skip = (Math.max(1, q.page || 1) - 1) * take;
    const where = { userId: user.id, ...(q.unreadOnly ? { read: false } : {}) };
    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notification.count({ where }), this.prisma.notification.count({ where: { userId: user.id, read: false } })]);
    return { notifications: rows.map(this.toDto), total, unreadCount };
  }

  async markRead(user: AuthUser, { id }: { id: string }) {
    const res = await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
    if (res.count === 0) throw rpcError(status.NOT_FOUND, 'Notification not found');
    return this.toDto(await this.prisma.notification.findUnique({ where: { id } }));
  }
  private toDto = (n: any) => ({ id: n.id, type: n.type, message: n.message, orderId: n.orderId ?? '', read: n.read, createdAt: new Date(n.createdAt).toISOString() });
}
