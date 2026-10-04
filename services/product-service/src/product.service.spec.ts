import { Metadata } from '@grpc/grpc-js';
import * as jwt from 'jsonwebtoken';
process.env.JWT_SECRET = 'test-secret';
import { AdminGuard } from './admin.guard';
import { ProductService } from './product.service';

const row = { id: 'p1', name: 'Mug', description: 'd', price: '12.50', imageUrl: null, categoryId: 'c1', category: { name: 'Home' }, createdAt: new Date() };
const makeRedis = () => { const m = new Map<string, string>(); return {
  get: jest.fn(async (k: string) => m.get(k) ?? null), set: jest.fn(async (k: string, v: string) => { m.set(k, v); }),
  incr: jest.fn(async (k: string) => { const n = Number(m.get(k) ?? 0) + 1; m.set(k, String(n)); return n; }),
  del: jest.fn(async (k: string) => { m.delete(k); }), ping: jest.fn(async () => 'PONG') }; };
const makePrisma = (): any => ({
  product: { findMany: jest.fn().mockResolvedValue([row]), count: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockResolvedValue(row), findUnique: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue(row), delete: jest.fn().mockResolvedValue(row) },
  category: { findUnique: jest.fn(async ({ where }: any) => (where.id === 'c1' ? { id: 'c1' } : null)) },
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
});
const code = async (p: Promise<unknown>) => p.then(() => null, (e) => e.getError().code);

describe('ProductService', () => {
  let prisma: any, events: any, svc: ProductService;
  beforeEach(() => { prisma = makePrisma(); events = { publish: jest.fn().mockResolvedValue(undefined) }; svc = new ProductService(prisma, makeRedis() as any, events); });

  it('serves repeated list queries from Redis and converts price to number', async () => {
    const a = await svc.list({ search: 'mug' }); await svc.list({ search: 'mug' });
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(a.products[0].price).toBe(12.5);
  });
  it('invalidates the list cache and publishes product.created on create', async () => {
    await svc.list({}); await svc.create({ name: 'Mug', description: 'd', price: 12.5, categoryId: 'c1' }); await svc.list({});
    expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
    expect(events.publish).toHaveBeenCalledWith('product.created', 'p1', { productId: 'p1', name: 'Mug', price: 12.5 });
  });
  it('validates input: bad price (3) and unknown category (5)', async () => {
    expect(await code(svc.create({ name: 'X', description: '', price: 0, categoryId: 'c1' }))).toBe(3);
    expect(await code(svc.create({ name: 'X', description: '', price: 5, categoryId: 'nope' }))).toBe(5);
  });
  it('returns NOT_FOUND when the product is missing', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    expect(await code(svc.get({ id: 'missing' }))).toBe(5);
  });
});

describe('AdminGuard', () => {
  const ctx = (auth?: string): any => { const md = new Metadata(); if (auth) md.set('authorization', auth); return { switchToRpc: () => ({ getContext: () => md }) }; };
  const tok = (role: string) => `Bearer ${jwt.sign({ role }, 'test-secret', { subject: 'u1' })}`;
  const guard = new AdminGuard();
  it('allows ADMIN', () => expect(guard.canActivate(ctx(tok('ADMIN')))).toBe(true));
  it('denies USER with PERMISSION_DENIED (7)', () => { try { guard.canActivate(ctx(tok('USER'))); fail('no throw'); } catch (e: any) { expect(e.getError().code).toBe(7); } });
  it('denies missing token with UNAUTHENTICATED (16)', () => { try { guard.canActivate(ctx()); fail('no throw'); } catch (e: any) { expect(e.getError().code).toBe(16); } });
});
