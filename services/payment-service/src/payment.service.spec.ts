import { decidePayment, PaymentService } from './payment.service';

const cfg = { failAbove: 1000, failureRate: 0, processingMs: 0, rng: () => 0.5 };
const row = (o: any = {}) => ({ id: 'pay1', orderId: 'o1', userId: 'u1', amount: 25, status: 'PENDING', failureReason: null, ...o });
const evt = (total: number): any => ({ payload: { orderId: 'o1', userId: 'u1', items: [], total } });
function setup(created = row()) {
  const prisma: any = { payment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  const events: any = { publish: jest.fn().mockResolvedValue(undefined) };
  return { prisma, events, svc: new PaymentService(prisma, events, cfg) };
}
const topics = (events: any) => events.publish.mock.calls.map((c: any[]) => c[0]);

describe('PaymentService.process (simulated)', () => {
  it('PENDING -> PROCESSING -> COMPLETED publishes payment.created then payment.completed', async () => {
    const { svc, events, prisma } = setup();
    await svc.process(evt(25));
    expect(topics(events)).toEqual(['payment.created', 'payment.completed']);
    expect(prisma.payment.updateMany.mock.calls[0][0].data.status).toBe('PROCESSING');
  });
  it('declines amounts above the limit and publishes payment.failed with a reason', async () => {
    const { svc, events } = setup(row({ amount: 1500 }));
    await svc.process(evt(1500));
    expect(topics(events)).toEqual(['payment.created', 'payment.failed']);
    expect(events.publish.mock.calls[1][2].reason).toMatch(/exceeds 1000/);
  });
  it('publishes nothing if the payment was cancelled while processing', async () => {
    const { svc, events, prisma } = setup();
    prisma.payment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await svc.process(evt(25));
    expect(topics(events)).toEqual(['payment.created']);
  });
  it('is idempotent: an already-finished payment is not processed again', async () => {
    const { svc, events, prisma } = setup();
    prisma.payment.findUnique.mockResolvedValue(row({ status: 'COMPLETED' }));
    await svc.process(evt(25));
    expect(prisma.payment.updateMany).not.toHaveBeenCalled(); expect(events.publish).not.toHaveBeenCalled();
  });
});

describe('PaymentService other', () => {
  it('createPayment returns the existing record without creating or publishing again', async () => {
    const { svc, events, prisma } = setup();
    prisma.payment.findUnique.mockResolvedValue(row());
    expect((await svc.createPayment({ orderId: 'o1', userId: 'u1', amount: 25 })).paymentId).toBe('pay1');
    expect(prisma.payment.create).not.toHaveBeenCalled(); expect(events.publish).not.toHaveBeenCalled();
  });
  it('rejects non-positive amounts', async () => {
    await expect(setup().svc.createPayment({ orderId: 'o1', userId: 'u1', amount: 0 })).rejects.toMatchObject({ error: { code: 3 } });
  });
  it('refunds a completed payment when the order is cancelled', async () => {
    const { svc, prisma } = setup();
    prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await svc.onOrderCancelled({ payload: { orderId: 'o1' } } as any);
    expect(prisma.payment.updateMany.mock.calls[1][0].data.status).toBe('REFUNDED');
  });
  it('decidePayment: limit and random failure', () => {
    expect(decidePayment(1001, cfg).ok).toBe(false);
    expect(decidePayment(10, { ...cfg, failureRate: 0.1, rng: () => 0.05 }).ok).toBe(false);
    expect(decidePayment(10, cfg).ok).toBe(true);
  });
});
