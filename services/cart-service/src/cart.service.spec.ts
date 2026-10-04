import { CartService } from './cart.service';

const user = { id: 'u1', email: 'a@b.c', role: 'USER' };
const code = (p: Promise<unknown>) => p.then(() => null, (e) => e.getError().code);
function setup(items: any[] = []) {
  const prisma: any = { cart: { upsert: jest.fn().mockResolvedValue({ id: 'c1' }), findUnique: jest.fn(async () => ({ items })) },
    cartItem: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  const product: any = { call: jest.fn(async () => ({ name: 'Mug', price: 12.5 })) };
  return { prisma, product, svc: new CartService(prisma, product) };
}

describe('CartService', () => {
  it('adds a new product and returns the enriched cart with live prices', async () => {
    const { svc, prisma } = setup([{ productId: 'p1', quantity: 2 }]);
    const cart = await svc.add(user, { productId: 'p1', quantity: 2 });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: { cartId: 'c1', productId: 'p1', quantity: 2 } });
    expect(cart).toMatchObject({ total: 25, itemCount: 2 });
  });
  it('increments an existing line and refuses to exceed 100 units', async () => {
    const { svc, prisma } = setup();
    prisma.cartItem.findUnique.mockResolvedValue({ id: 'i1', quantity: 5 });
    await svc.add(user, { productId: 'p1', quantity: 3 });
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { quantity: { increment: 3 } } });
    prisma.cartItem.findUnique.mockResolvedValue({ id: 'i1', quantity: 99 });
    expect(await code(svc.add(user, { productId: 'p1', quantity: 2 }))).toBe(3);
  });
  it('rejects unknown products and invalid quantities without writing', async () => {
    const { svc, prisma, product } = setup();
    product.call.mockRejectedValue(Object.assign(new Error('x'), { code: 5 }));
    expect(await code(svc.add(user, { productId: 'nope', quantity: 1 }))).toBe(5);
    expect(await code(svc.add(user, { productId: 'p1', quantity: 0 }))).toBe(3);
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
  it('flags deleted products as unavailable and excludes them from totals', async () => {
    const { svc, product } = setup([{ productId: 'p1', quantity: 1 }, { productId: 'gone', quantity: 4 }]);
    product.call.mockImplementation(async (_m: string, r: any) => { if (r.id === 'gone') throw Object.assign(new Error('x'), { code: 5 }); return { name: 'Mug', price: 12.5 }; });
    const cart = await svc.get(user);
    expect(cart.items[1].unavailable).toBe(true);
    expect(cart).toMatchObject({ total: 12.5, itemCount: 1 });
  });
  it('update on a missing line is NOT_FOUND; remove is idempotent', async () => {
    const { svc, prisma } = setup();
    prisma.cartItem.updateMany.mockResolvedValue({ count: 0 });
    expect(await code(svc.update(user, { productId: 'p1', quantity: 2 }))).toBe(5);
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(svc.remove(user, { productId: 'p1' })).resolves.toBeDefined();
  });
  it('order.created removes only the ordered products for that user', async () => {
    const { svc, prisma } = setup();
    await svc.onOrderCreated({ payload: { orderId: 'o1', userId: 'u1', total: 1, items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }] } } as any);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cart: { userId: 'u1' }, productId: { in: ['p1'] } } });
  });
});
