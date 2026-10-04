import { RpcException } from '@nestjs/microservices';
export { status } from '@grpc/grpc-js';
export const rpcError = (code: number, message: string) => new RpcException({ code, message });
export const isPrismaCode = (e: unknown, code: string) => (e as { code?: string })?.code === code;
