import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
process.env.JWT_SECRET = 'test-secret';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { ANALYTICS, AUTH, CART, INVENTORY, NOTIFICATION, ORDER, PRODUCT, REDIS } from './infra';

const token = (role: string) => jwt.sign({ email: 'user@example.com', role }, 'test-secret', { subject: 'u1', expiresIn: '1h', jwtid: randomUUID() });
const fakeClient = () => ({ call: jest.fn(), isReady: jest.fn().mockResolvedValue(true) });
const memRedis = () => { const m = new Map<string, any>(); return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: any) => { m.set(k, v); },
  incr: async (k: string) => { const n = (m.get(k) ?? 0) + 1; m.set(k, n); return n; }, expire: async () => 1, ping: async () => 'PONG' }; };
const mug = { id: '00000000-0000-4000-8000-000000000008', name: 'Mug', description: 'd', price: 12.5, imageUrl: '', categoryId: 'c1', categoryName: 'Home', createdAt: 'now' };

describe('GraphQL API (real schema, mocked downstream services)', () => {
  let app: INestApplication; const c: Record<string, ReturnType<typeof fakeClient>> = {};
  beforeAll(async () => {
    for (const k of [AUTH, PRODUCT, CART, ORDER, INVENTORY, NOTIFICATION, ANALYTICS]) c[k] = fakeClient();
    let b = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(REDIS).useValue(memRedis());
    for (const k of Object.keys(c)) b = b.overrideProvider(k).useValue(c[k]);
    app = configureApp((await b.compile()).createNestApplication()); await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => Object.values(c).forEach((x) => x.call.mockReset()));
  const gql = (query: string, tok?: string) => { const r = request(app.getHttpServer()).post('/graphql'); if (tok) r.set('Authorization', `Bearer ${tok}`); return r.send({ query }); };

  it('serves the public product catalogue without authentication', async () => {
    c[PRODUCT].call.mockResolvedValue({ products: [mug], total: 1 });
    const res = await gql('{ products(search: "mug") { total products { id name price } } }');
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.products.products[0]).toMatchObject({ name: 'Mug', price: 12.5 });
    expect(c[PRODUCT].call.mock.calls[0][0]).toBe('listProducts');
  });
  it('enforces roles on the server: anonymous=UNAUTHENTICATED, USER=FORBIDDEN, ADMIN=allowed (JWT forwarded downstream)', async () => {
    const q = '{ adminProducts { total } }';
    expect((await gql(q)).body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect((await gql(q, token('USER'))).body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(c[PRODUCT].call).not.toHaveBeenCalled();
    c[PRODUCT].call.mockResolvedValue({ products: [], total: 0 });
    const ok = await gql(q, token('ADMIN'));
    expect(ok.body.data.adminProducts.total).toBe(0);
    expect(c[PRODUCT].call.mock.calls[0][2].metadata.get('authorization')[0]).toMatch(/^Bearer /);
  });
  it('blocks every admin mutation for normal users', async () => {
    const ops = ['mutation { deleteProduct(id: "x") }', 'mutation { updateInventory(input: { productId: "00000000-0000-4000-8000-000000000001", quantity: 5 }) { productId } }',
      'mutation { updateOrderStatus(id: "o1", status: "SHIPPED") { id } }', '{ analytics { totalEvents } }', '{ adminOrders { total } }'];
    for (const op of ops) expect((await gql(op, token('USER'))).body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(Object.values(c).every((x) => x.call.mock.calls.length === 0)).toBe(true);
  });
  it('validates input before reaching any service', async () => {
    const res = await gql('mutation { register(input: { email: "not-an-email", password: "short", name: "A" }) { token } }');
    expect(res.body.errors).toBeDefined(); expect(JSON.stringify(res.body.errors)).toMatch(/email/);
    expect(c[AUTH].call).not.toHaveBeenCalled();
  });
  it('login returns a token and user from auth-service', async () => {
    c[AUTH].call.mockResolvedValue({ token: 't', user: { id: 'u1', email: 'user@example.com', name: 'A', role: 'USER', createdAt: 'now' } });
    const res = await gql('mutation { login(input: { email: "user@example.com", password: "password123" }) { token user { role } } }');
    expect(res.body.data.login).toEqual({ token: 't', user: { role: 'USER' } });
  });
  it('createOrder builds the order from the server-side cart and rejects an empty cart', async () => {
    c[CART].call.mockResolvedValue({ items: [], total: 0, itemCount: 0 });
    expect((await gql('mutation { createOrder { id } }', token('USER'))).body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    c[CART].call.mockResolvedValue({ items: [{ productId: mug.id, quantity: 2, unavailable: false }], total: 25, itemCount: 2 });
    c[ORDER].call.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', userId: 'u1', status: 'PENDING', total: 25, items: [], createdAt: 'n', updatedAt: 'n' });
    const res = await gql('mutation { createOrder { id status } }', token('USER'));
    expect(res.body.data.createOrder).toEqual({ id: 'o1', status: 'PENDING' });
    expect(c[ORDER].call.mock.calls[0].slice(0, 2)).toEqual(['createOrder', { items: [{ productId: mug.id, quantity: 2 }] }]);
  });
  it('logout revokes the token so it cannot be reused', async () => {
    const t = token('USER');
    expect((await gql('mutation { logout }', t)).body.data.logout).toBe(true);
    expect((await gql('{ notifications { total } }', t)).body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
  it('never leaks internal error details to clients', async () => {
    c[ORDER].call.mockRejectedValue(Object.assign(new Error('boom'), { code: 13, details: 'pg: password authentication failed for user "eventflow"' }));
    const res = await gql('{ orders { total } }', token('USER'));
    expect(res.body.errors[0].message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/password|eventflow|stack/i);
  });
  it('/health reports degraded when a downstream gRPC service is unreachable', async () => {
    c[CART].isReady.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200); expect(res.body.status).toBe('degraded'); expect(res.body.dependencies.cartService).toBe(false);
  });
});
