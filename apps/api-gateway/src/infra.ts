import { Metadata } from '@grpc/grpc-js';
import { GrpcCaller, status } from '@eventflow/service-common';
import { GraphQLError } from 'graphql';

export const REDIS = 'REDIS', AUTH = 'AUTH', PRODUCT = 'PRODUCT', CART = 'CART', ORDER = 'ORDER',
  INVENTORY = 'INVENTORY', NOTIFICATION = 'NOTIFICATION', ANALYTICS = 'ANALYTICS';

export interface GqlCtx { req: any; user?: { id: string; email: string; role: string }; token?: string; tokenExp?: number }

export const gqlError = (message: string, code: string) => new GraphQLError(message, { extensions: { code } });

/** gRPC status -> GraphQL error code. Only client-caused errors expose the downstream message. */
const MAP: Record<number, [string, boolean]> = {
  [status.INVALID_ARGUMENT]: ['BAD_USER_INPUT', true], [status.NOT_FOUND]: ['NOT_FOUND', true], [status.ALREADY_EXISTS]: ['CONFLICT', true],
  [status.PERMISSION_DENIED]: ['FORBIDDEN', true], [status.UNAUTHENTICATED]: ['UNAUTHENTICATED', true], [status.FAILED_PRECONDITION]: ['PRECONDITION_FAILED', true],
  [status.UNAVAILABLE]: ['SERVICE_UNAVAILABLE', false], [status.DEADLINE_EXCEEDED]: ['SERVICE_UNAVAILABLE', false],
};
export function mapGrpcError(e: any): GraphQLError {
  if (e instanceof GraphQLError) return e;
  const [code, expose] = MAP[e?.code] ?? ['INTERNAL_SERVER_ERROR', false]; // never leak internals
  const generic = code === 'SERVICE_UNAVAILABLE' ? 'Service temporarily unavailable' : 'Internal server error';
  return gqlError(expose ? String(e.details ?? e.message) : generic, code);
}

/** Calls a downstream service, forwarding the caller's JWT as gRPC metadata. */
export async function rpc<T = any>(client: GrpcCaller, method: string, req: object = {}, token?: string): Promise<T> {
  const metadata = new Metadata();
  if (token) metadata.set('authorization', `Bearer ${token}`);
  try { return await client.call<T>(method, req, { metadata }); } catch (e) { throw mapGrpcError(e); }
}
