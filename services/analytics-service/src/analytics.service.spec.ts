import { AnalyticsService } from './analytics.service';

const p2002 = Object.assign(new Error('dup'), { code: 'P2002' });
function setup() {
  const prisma: any = { eventLog: { create: jest.fn().mockResolvedValue({}), groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() }, $queryRaw: jest.fn(), $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)) };
  return { prisma, svc: new AnalyticsService(prisma) };
}
const env = (type: string, payload: any): any => ({ eventId: 'e1', type, source: 'order-service', occurredAt: '2026-01-01T00:00:00.000Z', payload });

describe('AnalyticsService', () => {
  it('records an event with the entity id taken from the payload', async () => {
    const { svc, prisma } = setup();
    await svc.record(env('order.created', { orderId: 'o1', userId: 'u1', total: 5 }));
    expect(prisma.eventLog.create.mock.calls[0][0].data).toMatchObject({ eventId: 'e1', topic: 'order.created', entityId: 'o1' });
  });
  it('ignores duplicate deliveries but surfaces real errors', async () => {
    const { svc, prisma } = setup();
    prisma.eventLog.create.mockRejectedValueOnce(p2002);
    await expect(svc.record(env('user.created', { userId: 'u1' }))).resolves.toBeUndefined();
    prisma.eventLog.create.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.record(env('user.created', { userId: 'u1' }))).rejects.toThrow('db down');
  });
  it('summarises counts per topic and net revenue', async () => {
    const { svc, prisma } = setup();
    prisma.eventLog.groupBy.mockResolvedValue([{ topic: 'order.created', _count: { _all: 4 } }, { topic: 'payment.completed', _count: { _all: 3 } }, { topic: 'payment.failed', _count: { _all: 1 } }, { topic: 'order.cancelled', _count: { _all: 1 } }]);
    prisma.$queryRaw.mockResolvedValue([{ revenue: '149.98' }]);
    const s = await svc.summary();
    expect(s).toMatchObject({ totalEvents: 9, ordersCreated: 4, ordersCancelled: 1, paymentsCompleted: 3, paymentsFailed: 1, revenue: 149.98 });
    expect(s.byTopic[0]).toEqual({ topic: 'order.created', count: 4 });
  });
  it('lists events filtered by topic with JSON payloads', async () => {
    const { svc, prisma } = setup();
    prisma.eventLog.findMany.mockResolvedValue([{ eventId: 'e1', topic: 'x', source: 's', entityId: null, payload: { a: 1 }, occurredAt: new Date() }]);
    prisma.eventLog.count.mockResolvedValue(1);
    const r = await svc.listEvents({ topic: 'x' });
    expect(prisma.eventLog.findMany.mock.calls[0][0].where).toEqual({ topic: 'x' });
    expect(r.events[0].payloadJson).toBe('{"a":1}');
  });
});
