import { Injectable, Logger } from '@nestjs/common';
import { EventEnvelope } from '@eventflow/kafka-events';
import { isPrismaCode } from '@eventflow/service-common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly log = new Logger('AnalyticsService');
  constructor(private readonly prisma: PrismaService) {}

  async record(e: EventEnvelope) {
    const p: any = e.payload;
    try {
      await this.prisma.eventLog.create({ data: { eventId: e.eventId, topic: e.type, source: e.source, entityId: p.orderId ?? p.productId ?? p.userId ?? null, payload: p, occurredAt: new Date(e.occurredAt) } });
      this.log.log(`Recorded ${e.type} from ${e.source}`);
    } catch (err) { if (!isPrismaCode(err, 'P2002')) throw err; } // duplicate delivery
  }

  async summary() {
    const [groups, revenueRows] = await Promise.all([
      this.prisma.eventLog.groupBy({ by: ['topic'], _count: { _all: true } }),
      // Net revenue = orders that were paid and not cancelled/refunded.
      this.prisma.$queryRaw`SELECT COALESCE(SUM((o.payload->>'total')::numeric), 0) AS revenue FROM "EventLog" o
        WHERE o.topic = 'order.created'
          AND EXISTS (SELECT 1 FROM "EventLog" p WHERE p.topic = 'payment.completed' AND p."entityId" = o."entityId")
          AND NOT EXISTS (SELECT 1 FROM "EventLog" c WHERE c.topic = 'order.cancelled' AND c."entityId" = o."entityId")`,
    ]);
    const byTopic = (groups as any[]).map((g) => ({ topic: g.topic as string, count: g._count._all as number })).sort((a, b) => b.count - a.count);
    const n = (t: string) => byTopic.find((x) => x.topic === t)?.count ?? 0;
    return { totalEvents: byTopic.reduce((s, x) => s + x.count, 0), byTopic, ordersCreated: n('order.created'), ordersCancelled: n('order.cancelled'),
      paymentsCompleted: n('payment.completed'), paymentsFailed: n('payment.failed'), revenue: Math.round(Number((revenueRows as any[])[0]?.revenue ?? 0) * 100) / 100 };
  }

  async listEvents({ topic, page, pageSize }: { topic?: string; page?: number; pageSize?: number }) {
    const take = Math.min(100, Math.max(1, pageSize || 25)); const skip = (Math.max(1, page || 1) - 1) * take;
    const where = topic ? { topic } : {};
    const [rows, total] = await this.prisma.$transaction([this.prisma.eventLog.findMany({ where, orderBy: { occurredAt: 'desc' }, skip, take }), this.prisma.eventLog.count({ where })]);
    return { total, events: rows.map((r: any) => ({ eventId: r.eventId, topic: r.topic, source: r.source, entityId: r.entityId ?? '', payloadJson: JSON.stringify(r.payload), occurredAt: new Date(r.occurredAt).toISOString() })) };
  }
}
