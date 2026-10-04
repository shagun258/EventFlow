import { Injectable, Logger } from '@nestjs/common';
import { EventEnvelope, EventPublisher, Topics } from '@eventflow/kafka-events';
import { isPrismaCode, rpcError, status } from '@eventflow/service-common';
import { PrismaService } from './prisma.service';

export interface SimConfig { failAbove: number; failureRate: number; processingMs: number; rng: () => number }
export const envConfig = (): SimConfig => ({
  failAbove: Number(process.env.PAYMENT_FAIL_ABOVE ?? 1000), failureRate: Number(process.env.PAYMENT_FAILURE_RATE ?? 0),
  processingMs: Number(process.env.PAYMENT_PROCESSING_MS ?? 1000), rng: Math.random,
});

/** SIMULATION: declines any amount above `failAbove`, plus an optional random failure rate. */
export function decidePayment(amount: number, cfg: Pick<SimConfig, 'failAbove' | 'failureRate' | 'rng'>) {
  if (amount > cfg.failAbove) return { ok: false, reason: `Simulated decline: amount exceeds ${cfg.failAbove} limit` };
  if (cfg.rng() < cfg.failureRate) return { ok: false, reason: 'Simulated decline: random failure' };
  return { ok: true, reason: undefined };
}

@Injectable()
export class PaymentService {
  private readonly log = new Logger('PaymentService');
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher, private readonly cfg: SimConfig = envConfig()) {}

  /** gRPC entry point. Idempotent per orderId. Creates the record as PENDING; processing happens on order.created. */
  async createPayment(dto: { orderId: string; userId: string; amount: number }) {
    if (!dto.orderId || !dto.userId || !(dto.amount > 0)) throw rpcError(status.INVALID_ARGUMENT, 'orderId, userId and positive amount required');
    const existing = await this.prisma.payment.findUnique({ where: { orderId: dto.orderId } });
    if (existing) return this.toDto(existing);
    let p;
    try { p = await this.prisma.payment.create({ data: { orderId: dto.orderId, userId: dto.userId, amount: dto.amount } }); }
    catch (e) {
      if (isPrismaCode(e, 'P2002')) return this.toDto(await this.prisma.payment.findUnique({ where: { orderId: dto.orderId } }));
      throw e;
    }
    this.log.log(`Payment created (simulated) ${p.id} for order ${dto.orderId}`);
    await this.events.publish(Topics.PAYMENT_CREATED, dto.orderId, { paymentId: p.id, orderId: dto.orderId, amount: dto.amount })
      .catch((e) => this.log.error(`Failed to publish payment.created: ${e.message}`));
    return this.toDto(p);
  }

  async getPaymentStatus({ orderId }: { orderId: string }) {
    const p = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!p) throw rpcError(status.NOT_FOUND, 'Payment not found');
    return this.toDto(p);
  }

  /** order.created -> PENDING -> PROCESSING -> COMPLETED | FAILED. Every transition is a conditional update, so replays and cancel races are safe. */
  async process(e: EventEnvelope<'order.created'>) {
    const { orderId, userId, total } = e.payload;
    const p = await this.createPayment({ orderId, userId, amount: total });
    if (p.status !== 'PENDING') return;
    const claimed = await this.prisma.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'PROCESSING' } });
    if (claimed.count === 0) return;
    this.log.log(`Processing (simulated) payment ${p.paymentId} for order ${orderId}`);
    await new Promise((r) => setTimeout(r, this.cfg.processingMs));
    const outcome = decidePayment(p.amount, this.cfg);
    const done = await this.prisma.payment.updateMany({ where: { orderId, status: 'PROCESSING' },
      data: outcome.ok ? { status: 'COMPLETED' } : { status: 'FAILED', failureReason: outcome.reason } });
    if (done.count === 0) { this.log.warn(`Payment for order ${orderId} was cancelled mid-processing; no event published`); return; }
    if (outcome.ok) {
      this.log.log(`Payment completed for order ${orderId}`);
      await this.events.publish(Topics.PAYMENT_COMPLETED, orderId, { paymentId: p.paymentId, orderId, userId });
    } else {
      this.log.warn(`Payment failed for order ${orderId}: ${outcome.reason}`);
      await this.events.publish(Topics.PAYMENT_FAILED, orderId, { paymentId: p.paymentId, orderId, userId, reason: outcome.reason as string });
    }
  }

  /** order.cancelled -> stop unfinished payments; refund (simulated) completed ones. */
  async onOrderCancelled(e: EventEnvelope<'order.cancelled'>) {
    const { orderId } = e.payload;
    const stopped = await this.prisma.payment.updateMany({ where: { orderId, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'CANCELLED' } });
    if (stopped.count) return void this.log.log(`Payment cancelled for order ${orderId}`);
    const refunded = await this.prisma.payment.updateMany({ where: { orderId, status: 'COMPLETED' }, data: { status: 'REFUNDED' } });
    if (refunded.count) this.log.log(`Payment refunded (simulated) for order ${orderId}`);
  }

  private toDto = (p: any) => ({ paymentId: p.id, orderId: p.orderId, status: p.status as string, failureReason: p.failureReason ?? '', amount: Number(p.amount) });
}
