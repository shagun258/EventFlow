import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
process.env.JWT_SECRET = 'test-secret';
import { AdminGuard, AuthGuard, Limit, RateLimitGuard, tokenKey } from './guards';
import { mapGrpcError } from './infra';

const sign = (role = 'USER', secret = 'test-secret') => jwt.sign({ email: 'a@b.c', role }, secret, { subject: 'u1', expiresIn: '1h' });
const ctx = (headers: any = {}, handler: any = function op() {}): any => { const args = [null, {}, { req: { ip: '1.1.1.1', headers } }, {}]; return { getArgs: () => args, getClass: () => Object, getHandler: () => handler, getType: () => 'graphql' }; };
const fakeRedis = () => { const m = new Map<string, any>(); return { get: jest.fn(async (k: string) => m.get(k) ?? null), set: jest.fn(async (k: string, v: any) => { m.set(k, v); }),
  incr: jest.fn(async (k: string) => { const n = (m.get(k) ?? 0) + 1; m.set(k, n); return n; }), expire: jest.fn(async () => 1), m }; };
const codeOf = async (p: Promise<unknown> | (() => unknown)) => { try { await (typeof p === 'function' ? p() : p); } catch (e: any) { return e.extensions?.code; } return null; };

describe('AuthGuard / AdminGuard', () => {
  it('accepts a valid token and exposes the user on the context', async () => {
    const c = ctx({ authorization: `Bearer ${sign('ADMIN')}` });
    expect(await new AuthGuard(fakeRedis() as any).canActivate(c)).toBe(true);
    expect(c.getArgs()[2].user).toEqual({ id: 'u1', email: 'a@b.c', role: 'ADMIN' });
  });
  it('rejects missing, forged and revoked tokens with UNAUTHENTICATED', async () => {
    const redis = fakeRedis(); const guard = new AuthGuard(redis as any);
    expect(await codeOf(guard.canActivate(ctx()))).toBe('UNAUTHENTICATED');
    expect(await codeOf(guard.canActivate(ctx({ authorization: `Bearer ${sign('ADMIN', 'wrong')}` })))).toBe('UNAUTHENTICATED');
    const t = sign(); redis.m.set(tokenKey(t), '1');
    expect(await codeOf(guard.canActivate(ctx({ authorization: `Bearer ${t}` })))).toBe('UNAUTHENTICATED');
  });
  it('AdminGuard forbids USER and allows ADMIN', () => {
    const user: any = ctx(); user.getArgs()[2].user = { role: 'USER' };
    const admin: any = ctx(); admin.getArgs()[2].user = { role: 'ADMIN' };
    expect(() => new AdminGuard().canActivate(user)).toThrow('Admin access required');
    expect(new AdminGuard().canActivate(admin)).toBe(true);
  });
});

describe('RateLimitGuard', () => {
  class T { @Limit(2) login() {} }
  it('blocks after the per-endpoint limit and starts a 60s window on first hit', async () => {
    const redis = fakeRedis(); const g = new RateLimitGuard(redis as any, new Reflector()); const c = ctx({}, T.prototype.login);
    expect(await g.canActivate(c)).toBe(true); expect(await g.canActivate(c)).toBe(true);
    expect(await codeOf(g.canActivate(c))).toBe('TOO_MANY_REQUESTS');
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });
  it('fails open when Redis is unavailable', async () => {
    const redis: any = { incr: jest.fn().mockRejectedValue(new Error('down')) };
    expect(await new RateLimitGuard(redis, new Reflector()).canActivate(ctx())).toBe(true);
  });
});

describe('mapGrpcError', () => {
  it('exposes client errors, hides internal ones', () => {
    expect(mapGrpcError({ code: 5, details: 'Product not found' }).extensions.code).toBe('NOT_FOUND');
    expect(mapGrpcError({ code: 14, details: 'connect ECONNREFUSED 10.0.0.5' })).toMatchObject({ message: 'Service temporarily unavailable', extensions: { code: 'SERVICE_UNAVAILABLE' } });
    const internal = mapGrpcError({ code: 13, details: 'select * from users; password=hunter2' });
    expect(internal.message).toBe('Internal server error'); expect(internal.extensions.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
