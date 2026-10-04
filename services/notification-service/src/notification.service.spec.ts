import { NotificationService } from './notification.service';

const p2002 = Object.assign(new Error('dup'), { code: 'P2002' });
function setup() {
  const prisma: any = { notification: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ id: 'n1', type: 'X', message: 'm', read: true, createdAt: new Date() }), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)) };
  const events: any = { publish: jest.fn().mockResolvedValue(undefined) };
  return { prisma, events, svc: new NotificationService(prisma, events) };
}
const ev = (payload: any, eventId = 'e1'): any => ({ eventId, payload });

describe('NotificationService', () => {
  it('turns order.created into an ORDER_PLACED notification and publishes notification.created', async () => {
    const { svc, prisma, events } = setup();
    await svc.onOrderCreated(ev({ orderId: 'o1', userId: 'u1', total: 25, items: [] }));
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ eventId: 'e1', userId: 'u1', type: 'ORDER_PLACED', orderId: 'o1' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('$25.00');
    expect(events.publish.mock.calls[0][0]).toBe('notification.created');
  });
  it('is idempotent: a redelivered event creates and publishes nothing', async () => {
    const { svc, prisma, events } = setup();
    prisma.notification.create.mockRejectedValue(p2002);
    await svc.onOrderCancelled(ev({ orderId: 'o1', userId: 'u1' }));
    expect(events.publish).not.toHaveBeenCalled();
  });
  it('notifies on PAID/SHIPPED but ignores PAYMENT_FAILED status (payment.failed carries the reason)', async () => {
    const { svc, prisma } = setup();
    await svc.onOrderStatus(ev({ orderId: 'o1', userId: 'u1', status: 'PAID' }));
    await svc.onOrderStatus(ev({ orderId: 'o1', userId: 'u1', status: 'PAYMENT_FAILED' }, 'e2'));
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create.mock.calls[0][0].data.type).toBe('ORDER_PAID');
  });
  it('payment.failed includes the decline reason', async () => {
    const { svc, prisma } = setup();
    await svc.onPaymentFailed(ev({ orderId: 'o1', userId: 'u1', paymentId: 'p', reason: 'Simulated decline' }));
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('Simulated decline');
  });
  it("markRead only touches the caller's own notifications", async () => {
    const { svc, prisma } = setup();
    await svc.markRead({ id: 'u1', email: '', role: 'USER' }, { id: 'n1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'u1' }, data: { read: true } });
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.markRead({ id: 'u2', email: '', role: 'USER' }, { id: 'n1' })).rejects.toMatchObject({ error: { code: 5 } });
  });
});
