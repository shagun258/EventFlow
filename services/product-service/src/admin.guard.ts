import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import * as jwt from 'jsonwebtoken';
import { rpcError, status } from './rpc-error';

/** Defence in depth: even if the gateway is bypassed, write RPCs require a valid ADMIN JWT. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const md = ctx.switchToRpc().getContext() as Metadata;
    const token = String(md.get('authorization')[0] ?? '').replace(/^Bearer\s+/i, '');
    let role: unknown;
    try { role = (jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as jwt.JwtPayload).role; }
    catch { throw rpcError(status.UNAUTHENTICATED, 'Valid token required'); }
    if (role !== 'ADMIN') throw rpcError(status.PERMISSION_DENIED, 'Admin access required');
    return true;
  }
}
