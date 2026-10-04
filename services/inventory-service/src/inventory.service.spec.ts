import { InventoryService } from './inventory.service';

const tx: any = { $executeRaw: jest.fn(), reservation: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() } };
const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)), reservation: { findUnique: jest.fn() }, inventory: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() } };
const events: any = { publish: jest.fn().mockResolvedValue(undefined) };
const svc = new InventoryService(prisma, events);
const held = (status: string) => ({ id: 'r1', orderId: 'o1', status, items: [{ productId: 'p1', quantity: 2 }] });

beforeEach(() => {
  jest.clearAllMocks();
  tx.$executeRaw.mockResolvedValue(1); tx.reservation.updateMany.mockResolvedValue({ count: 1 });
  prisma.reservation.findUnique.mockResolvedValue(null);
});

describe('reserveStock', () => {
  it('reserves, persists the reservation and publishes inventory.reserved', async () => {
    expect((await svc.reserveStock({ orderId: 'o1', items: [{ productId: 'p1', quantity: 2 }] })).success).toBe(true);
    expect(tx.reservation.create).toHaveBeenCalledTimes(1);
    expect(events.publish.mock.calls[0][0]).toBe('inventory.reserved');
  });
  it('merges duplicate lines and locks rows in productId order (deadlock avoidance)', async () => {
    await svc.reserveStock({ orderId: 'o1', items: [{ productId: 'p2', quantity: 1 }, { productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 3 }] });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw.mock.calls[0].slice(1, 3)).toEqual([5, 'p1']);
  });
  it('fails cleanly on insufficient stock: nothing persisted, nothing published', async () => {
    tx.$executeRaw.mockResolvedValue(0);
    const res = await svc.reserveStock({ orderId: 'o1', items: [{ productId: 'p1', quantity: 99 }] });
    expect(res).toEqual({ success: false, message: 'Insufficient stock for product p1' });
    expect(tx.reservation.create).not.toHaveBeenCalled(); expect(events.publish).not.toHaveBeenCalled();
  });
  it('is idempotent: a second reserve for the same order does not touch stock', async () => {
    prisma.reservation.findUnique.mockResolvedValue(held('RESERVED'));
    expect((await svc.reserveStock({ orderId: 'o1', items: [{ productId: 'p1', quantity: 2 }] })).success).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('confirm / release', () => {
  it('confirm deducts stock once for a RESERVED reservation', async () => {
    tx.reservation.findUnique.mockResolvedValue(held('RESERVED'));
    await svc.confirm({ payload: { orderId: 'o1' } } as any);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('confirm ignores a reservation that was already released (payment arrived after cancel)', async () => {
    tx.reservation.findUnique.mockResolvedValue(held('RELEASED'));
    await svc.confirm({ payload: { orderId: 'o1' } } as any);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('release frees the hold and publishes inventory.released', async () => {
    tx.reservation.findUnique.mockResolvedValue(held('RESERVED'));
    await svc.release('o1');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith('inventory.released', 'o1', { orderId: 'o1' });
  });
  it('release is idempotent for an already-released or unknown order', async () => {
    tx.reservation.findUnique.mockResolvedValueOnce(held('RELEASED')).mockResolvedValueOnce(null);
    await svc.release('o1'); await svc.release('o2');
    expect(tx.$executeRaw).not.toHaveBeenCalled(); expect(events.publish).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('refuses to set stock below reserved units', async () => {
    prisma.inventory.findUnique.mockResolvedValue({ productId: 'p1', quantity: 10, reserved: 5 });
    await expect(svc.update({ productId: 'p1', quantity: 3 })).rejects.toMatchObject({ error: { code: 9 } });
  });
});
