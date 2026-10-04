import { OrderService } from './order.service';

const user = { id: 'u1', email: 'a@b.c', role: 'USER' };
const mk = (o: any = {}) => ({ id: 'o1', orderNumber: 'ORD-1', userId: 'u1', status: 'PENDING', total: 25, failureReason: null, createdAt: new Date(), updatedAt: new Date(),
  items: [{ productId: 'p1', productName: 'Mug', unitPrice: 12.5, quantity: 2 }], ...o });
const grpcErr = (code: number) => Object.assign(new Error('grpc'), { code });
const code = (p: Promise<unknown>) => p.then(() => null, (e) => e.getError().code);

function setup() {
  const prisma: any = { order: { create: jest.fn(async () => mk()), update: jest.fn(async () => mk()), updateMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(async () => mk()) } };
  const events: any = { publish: jest.fn().mockResolvedValue(undefined) };
  const product: any = { call: jest.fn(async () => ({ name: 'Mug', price: 12.5 })) };
  const inventory: any = { call: jest.fn(async (m: string) => (m === 'reserveStock' ? { success: true, message: '' } : { success: true })) };
  const payment: any = { call: jest.fn(async () => ({ paymentId: 'pay1' })) };
  return { prisma, events, product, inventory, payment, svc: new OrderService(prisma, events, product, inventory, payment) };
}
const req = { items: [{ productId: 'p1', quantity: 2 }] };

describe('OrderService.create', () => {
  it('prices from product-service, reserves stock, creates payment, then publishes order.created', async () => {
    const { svc, prisma, inventory, payment, events } = setup();
    const res = await svc.create(user, req);
    expect(prisma.order.create.mock.calls[0][0].data.total).toBe(25);
    expect(inventory.call).toHaveBeenCalledWith('reserveStock', { orderId: 'o1', items: [{ productId: 'p1', quantity: 2 }] });
    expect(payment.call).toHaveBeenCalledWith('createPayment', { orderId: 'o1', userId: 'u1', amount: 25 });
    expect(events.publish.mock.calls[0][0]).toBe('order.created');
    expect(res.status).toBe('PENDING');
  });
  it('rejects the order on insufficient stock (FAILED_PRECONDITION) without payment or event', async () => {
    const { svc, prisma, inventory, payment, events } = setup();
    inventory.call.mockResolvedValue({ success: false, message: 'Insufficient stock for product p1' });
    expect(await code(svc.create(user, req))).toBe(9);
    expect(prisma.order.update.mock.calls[0][0].data.status).toBe('REJECTED');
    expect(payment.call).not.toHaveBeenCalled(); expect(events.publish).not.toHaveBeenCalled();
  });
  it('returns UNAVAILABLE and rejects when inventory-service is down', async () => {
    const { svc, prisma, inventory } = setup();
    inventory.call.mockRejectedValue(grpcErr(14));
    expect(await code(svc.create(user, req))).toBe(14);
    expect(prisma.order.update.mock.calls[0][0].data.failureReason).toMatch(/Inventory service unavailable/);
  });
  it('compensates by releasing stock when payment-service is down', async () => {
    const { svc, inventory, payment } = setup();
    payment.call.mockRejectedValue(grpcErr(14));
    expect(await code(svc.create(user, req))).toBe(14);
    expect(inventory.call).toHaveBeenCalledWith('releaseStock', { orderId: 'o1' });
  });
  it('compensates when Kafka publishing fails', async () => {
    const { svc, inventory, events } = setup();
    events.publish.mockRejectedValue(new Error('kafka down'));
    expect(await code(svc.create(user, req))).toBe(14);
    expect(inventory.call).toHaveBeenCalledWith('releaseStock', { orderId: 'o1' });
  });
  it('validates items and unknown products', async () => {
    const { svc, product } = setup();
    expect(await code(svc.create(user, { items: [] }))).toBe(3);
    expect(await code(svc.create(user, { items: [{ productId: 'p1', quantity: 0 }] }))).toBe(3);
    product.call.mockRejectedValue(grpcErr(5));
    expect(await code(svc.create(user, req))).toBe(5);
  });
});

describe('cancel / status / events', () => {
  it('cancels a PENDING order and publishes order.cancelled', async () => {
    const { svc, prisma, events } = setup();
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    await svc.cancel(user, { id: 'o1' });
    expect(prisma.order.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'o1', userId: 'u1' });
    expect(events.publish.mock.calls[0][0]).toBe('order.cancelled');
  });
  it("hides other users' orders (NOT_FOUND) and blocks cancelling shipped orders (FAILED_PRECONDITION)", async () => {
    const { svc, prisma } = setup();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    prisma.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(mk({ status: 'SHIPPED' }));
    expect(await code(svc.cancel(user, { id: 'x' }))).toBe(5);
    expect(await code(svc.cancel(user, { id: 'o1' }))).toBe(9);
  });
  it('non-admins cannot list all orders; admin status changes must be SHIPPED/DELIVERED', async () => {
    const { svc } = setup();
    expect(await code(svc.list(user, { all: true }))).toBe(7);
    expect(await code(svc.updateStatus({ ...user, role: 'ADMIN' }, { id: 'o1', status: 'PENDING' }))).toBe(3);
  });
  it('payment.failed moves a PENDING order to PAYMENT_FAILED and publishes order.status_updated', async () => {
    const { svc, prisma, events } = setup();
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    await svc.onPaymentFailed({ payload: { orderId: 'o1', userId: 'u1', paymentId: 'p', reason: 'declined' } } as any);
    expect(prisma.order.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'o1', status: 'PENDING' }, data: { status: 'PAYMENT_FAILED', failureReason: 'declined' } });
    expect(events.publish).toHaveBeenCalledWith('order.status_updated', 'o1', { orderId: 'o1', userId: 'u1', status: 'PAYMENT_FAILED' });
  });
  it('ignores payment.completed for an order that is no longer PENDING (e.g. cancelled)', async () => {
    const { svc, prisma, events } = setup();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    await svc.onPaymentCompleted({ payload: { orderId: 'o1', userId: 'u1', paymentId: 'p' } } as any);
    expect(events.publish).not.toHaveBeenCalled();
  });
});
