import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { RpcException } from '@nestjs/microservices';
import * as jwt from 'jsonwebtoken';
import { join, resolve } from 'path';

export const status = grpc.status;
export const rpcError = (code: number, message: string) => new RpcException({ code, message });
export const isPrismaCode = (e: unknown, code: string) => (e as { code?: string })?.code === code;

export const LOADER = { keepCase: false, longs: String, enums: String, defaults: true, oneofs: true };
/** Proto files live in /packages/proto; services run with cwd = services/<name>. */
export const protoFile = (file: string) => join(process.env.PROTO_DIR ?? resolve(process.cwd(), '../../packages/proto'), file);
export const grpcServerOptions = (pkg: string, file: string, port: string | number) =>
  ({ package: pkg, protoPath: protoFile(file), url: `0.0.0.0:${port}`, loader: LOADER });

export interface AuthUser { id: string; email: string; role: string }

/** Caller identity always comes from the verified JWT in gRPC metadata, never from request fields. */
export function requireUser(md: grpc.Metadata): AuthUser {
  const token = String(md.get('authorization')[0] ?? '').replace(/^Bearer\s+/i, '');
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    return { id: p.sub as string, email: p.email as string, role: p.role as string };
  } catch { throw rpcError(status.UNAUTHENTICATED, 'Valid token required'); }
}
export function requireAdmin(md: grpc.Metadata): AuthUser {
  const user = requireUser(md);
  if (user.role !== 'ADMIN') throw rpcError(status.PERMISSION_DENIED, 'Admin access required');
  return user;
}

export interface GrpcCaller {
  call<T = any>(method: string, req: object, opts?: { metadata?: grpc.Metadata; timeoutMs?: number }): Promise<T>;
  isReady(timeoutMs?: number): Promise<boolean>;
}
/** Promise-based gRPC client with a per-call deadline (default 3s). */
export function grpcClient(file: string, pkg: string, service: string, url: string): GrpcCaller {
  const def = protoLoader.loadSync(protoFile(file), LOADER);
  const Ctor = (grpc.loadPackageDefinition(def) as any)[pkg][service];
  const client = new Ctor(url, grpc.credentials.createInsecure());
  return {
    call: (method, req, opts) => new Promise((resolve, reject) =>
      client[method](req, opts?.metadata ?? new grpc.Metadata(), { deadline: Date.now() + (opts?.timeoutMs ?? 3000) },
        (err: Error | null, res: any) => (err ? reject(err) : resolve(res)))),
    isReady: (ms = 1000) => new Promise((resolve) => client.waitForReady(Date.now() + ms, (err?: Error) => resolve(!err))),
  };
}
