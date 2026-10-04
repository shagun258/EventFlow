import { Injectable, Logger } from '@nestjs/common';
import { EventEnvelope, EventPublisher, Topics } from '@eventflow/kafka-events';
import { isPrismaCode, rpcError, status } from '@eventflow/service-common';
import { PrismaService, Tx } from './prisma.service';

type Line = { productId: string; quantity: number };
class InsufficientStock extends Error { constructor(readonly productId: string) { super(`Insufficient stock for product ${productId}`); } }

/** Merge duplicates and sort by productId so concurrent reservations lock rows in the same order (no deadlocks). */
const normalize = (items: Line[] = []): Line[] => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
  return [...m].map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => a.productId.localeCompare(b.productId));
};

@Injectable()
export class InventoryService {
  private readonly log = new Logger('InventoryService');
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher) {}

  async checkStock({ items }: { items: Line[] }) {
    const lines = normalize(items);
    const rows = await this.prisma.inventory.findMany({ where: { productId: { in: lines.map((l) => l.productId) } } });
    const avail = new Map<string, number>(rows.map((r: any) => [r.productId, r.quantity - r.reserved] as [string, number]));
    const unavailable = lines.filter((l) => (avail.get(l.productId) ?? 0) < l.quantity).map((l) => l.productId);
    return { available: unavailable.length === 0, unavailableProductIds: unavailable };
  }

  /** Atomic + race-safe: each UPDATE only succeeds if enough unreserved stock remains; any miss rolls back everything. */
  async reserveStock({ orderId, items }: { orderId: string; items: Line[] }) {
    const lines = normalize(items);
    if (!orderId || lines.length === 0 || lines.some((l) => !(l.quantity > 0))) throw rpcError(status.INVALID_ARGUMENT, 'orderId and positive quantities required');
    const existing = await this.prisma.reservation.findUnique({ where: { orderId } });
    if (existing) return existing.status === 'RELEASED' ? { success: false, message: 'Reservation already released' } : { success: true, message: 'Already reserved' };
    try {
      await this.prisma.$transaction(async (tx: Tx) => {
        for (const l of lines) {
          const n = await tx.$executeRaw`UPDATE "Inventory" SET reserved = reserved + ${l.quantity}, "updatedAt" = now() WHERE "productId" = ${l.productId} AND quantity - reserved >= ${l.quantity}`;
          if (n === 0) throw new InsufficientStock(l.productId);
        }
        await tx.reservation.create({ data: { orderId, items: { create: lines } } });
      });
    } catch (e) {
      if (e instanceof InsufficientStock) { this.log.warn(`Reserve failed for order ${orderId}: ${e.message}`); return { success: false, message: e.message }; }
      if (isPrismaCode(e, 'P2002')) return { success: true, message: 'Already reserved' }; // concurrent duplicate request
      throw e;
    }
    this.log.log(`Stock reserved for order ${orderId} (${lines.length} product(s))`);
    await this.events.publish(Topics.INVENTORY_RESERVED, orderId, { orderId, items: lines.map((l) => ({ ...l, unitPrice: 0 })) })
      .catch((e) => this.log.error(`Failed to publish inventory.reserved: ${e.message}`));
    return { success: true, message: 'Reserved' };
  }

  /** payment.completed -> RESERVED becomes CONFIRMED and physical stock is deducted. No-op if not RESERVED (idempotent). */
  async confirm(e: EventEnvelope<'payment.completed'>) {
    const { orderId } = e.payload;
    await this.prisma.$transaction(async (tx: Tx) => {
      const r = await tx.reservation.findUnique({ where: { orderId }, include: { items: true } });
      if (!r || r.status !== 'RESERVED') return;
      const claimed = await tx.reservation.updateMany({ where: { id: r.id, status: 'RESERVED' }, data: { status: 'CONFIRMED' } });
      if (claimed.count === 0) return;
      for (const i of r.items) await tx.$executeRaw`UPDATE "Inventory" SET quantity = quantity - ${i.quantity}, reserved = reserved - ${i.quantity}, "updatedAt" = now() WHERE "productId" = ${i.productId}`;
      this.log.log(`Stock confirmed for order ${orderId}`);
    });
  }

  /** payment.failed / order.cancelled -> give stock back. RESERVED: drop the hold. CONFIRMED: restock. */
  async release(orderId: string) {
    const released = await this.prisma.$transaction(async (tx: Tx) => {
      const r = await tx.reservation.findUnique({ where: { orderId }, include: { items: true } });
      if (!r || r.status === 'RELEASED') return false;
      const claimed = await tx.reservation.updateMany({ where: { id: r.id, status: r.status }, data: { status: 'RELEASED' } });
      if (claimed.count === 0) return false;
      for (const i of r.items) {
        if (r.status === 'RESERVED') await tx.$executeRaw`UPDATE "Inventory" SET reserved = reserved - ${i.quantity}, "updatedAt" = now() WHERE "productId" = ${i.productId}`;
        else await tx.$executeRaw`UPDATE "Inventory" SET quantity = quantity + ${i.quantity}, "updatedAt" = now() WHERE "productId" = ${i.productId}`;
      }
      return true;
    });
    if (!released) return { success: true };
    this.log.log(`Stock released for order ${orderId}`);
    await this.events.publish(Topics.INVENTORY_RELEASED, orderId, { orderId }).catch((e) => this.log.error(`Failed to publish inventory.released: ${e.message}`));
    return { success: true };
  }

  async list({ page, pageSize }: { page?: number; pageSize?: number }) {
    const take = Math.min(100, Math.max(1, pageSize || 20)); const skip = (Math.max(1, page || 1) - 1) * take;
    const [rows, total] = await this.prisma.$transaction([this.prisma.inventory.findMany({ orderBy: { productId: 'asc' }, skip, take }), this.prisma.inventory.count()]);
    return { items: rows.map(this.toDto), total };
  }

  async update({ productId, quantity }: { productId: string; quantity: number }) {
    if (!productId || !Number.isInteger(quantity) || quantity < 0) throw rpcError(status.INVALID_ARGUMENT, 'productId and non-negative integer quantity required');
    const cur = await this.prisma.inventory.findUnique({ where: { productId } });
    if (cur && quantity < cur.reserved) throw rpcError(status.FAILED_PRECONDITION, `Cannot set below reserved units (${cur.reserved})`);
    const row = await this.prisma.inventory.upsert({ where: { productId }, update: { quantity }, create: { productId, quantity } });
    this.log.log(`Inventory updated: ${productId} -> ${quantity}`);
    return this.toDto(row);
  }
  private toDto = (r: any) => ({ productId: r.productId, quantity: r.quantity, reserved: r.reserved, available: r.quantity - r.reserved });
}
