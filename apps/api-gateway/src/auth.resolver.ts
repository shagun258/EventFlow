import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type Redis from 'ioredis';
import { GrpcCaller } from '@eventflow/service-common';
import { Auth, Limit, tokenKey } from './guards';
import { AUTH, GqlCtx, REDIS, rpc } from './infra';
import { AuthPayload, LoginInput, RegisterInput, User } from './types';

@Resolver()
export class AuthResolver {
  constructor(@Inject(AUTH) private readonly auth: GrpcCaller, @Inject(REDIS) private readonly redis: Redis) {}

  @Limit(10) @Mutation(() => AuthPayload)
  register(@Args('input') input: RegisterInput) { return rpc(this.auth, 'register', input); }

  @Limit(10) @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput) { return rpc(this.auth, 'login', input); }

  /** JWTs are stateless, so logout blacklists the token in Redis until it would have expired anyway. */
  @Auth() @Mutation(() => Boolean)
  async logout(@Context() ctx: GqlCtx) {
    const ttl = Math.max(1, (ctx.tokenExp ?? 0) - Math.floor(Date.now() / 1000));
    await this.redis.set(tokenKey(ctx.token as string), '1', 'EX', ttl);
    return true;
  }

  @Auth() @Query(() => User)
  me(@Context() ctx: GqlCtx) { return rpc(this.auth, 'getUser', { id: ctx.user!.id }); }
}
