import { applyDecorators, CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';
import { GqlCtx, gqlError, REDIS } from './infra';

const ctxOf = (c: ExecutionContext) => GqlExecutionContext.create(c).getContext<GqlCtx>();
export const tokenKey = (token: string) => `bl:${createHash('sha256').update(token).digest('hex')}`;

/** Verifies the JWT, rejects tokens revoked by `logout` (Redis blacklist), and exposes the user on the GraphQL context. */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly secret = process.env.JWT_SECRET as string;
  constructor(@Inject(REDIS) private readonly redis: Redis) { if (!this.secret) throw new Error('JWT_SECRET is required'); }
  async canActivate(c: ExecutionContext) {
    const ctx = ctxOf(c);
    const token = String(ctx.req?.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
    let p: jwt.JwtPayload;
    try { p = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload; }
    catch { throw gqlError('Authentication required', 'UNAUTHENTICATED'); }
    // Fail-open if Redis is down: availability over revocation (tokens are short-lived).
    if (await this.redis.get(tokenKey(token)).catch(() => null)) throw gqlError('Authentication required', 'UNAUTHENTICATED');
    ctx.user = { id: p.sub as string, email: p.email as string, role: p.role as string };
    ctx.token = token; ctx.tokenExp = p.exp;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(c: ExecutionContext) {
    if (ctxOf(c).user?.role !== 'ADMIN') throw gqlError('Admin access required', 'FORBIDDEN');
    return true;
  }
}
export const Auth = () => UseGuards(AuthGuard);
export const Admin = () => applyDecorators(UseGuards(AuthGuard, AdminGuard));

/** Fixed-window rate limit per IP in Redis. Default 120/min; use @Limit(n) for stricter endpoints such as login. */
export const Limit = (perMinute: number) => SetMetadata('rateLimit', perMinute);
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS) private readonly redis: Redis, private readonly reflector: Reflector) {}
  async canActivate(c: ExecutionContext) {
    const custom = this.reflector.get<number | undefined>('rateLimit', c.getHandler());
    const limit = custom ?? Number(process.env.RATE_LIMIT_PER_MIN ?? 120);
    const key = `rl:${ctxOf(c).req?.ip ?? 'unknown'}:${custom ? c.getHandler().name : 'global'}`;
    let n = 0;
    try { n = await this.redis.incr(key); if (n === 1) await this.redis.expire(key, 60); } catch { return true; } // fail-open
    if (n > limit) throw gqlError('Too many requests, slow down', 'TOO_MANY_REQUESTS');
    return true;
  }
}
