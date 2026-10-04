import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { EventPublisher, Topics } from '@eventflow/kafka-events';
import { PrismaService } from './prisma.service';
import { isPrismaCode, rpcError, status } from './rpc-error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  private readonly log = new Logger('AuthService');
  private readonly secret = process.env.JWT_SECRET as string;

  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher) {
    if (!this.secret) throw new Error('JWT_SECRET is required');
  }

  async register(dto: { email: string; password: string; name: string }) {
    const email = (dto.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw rpcError(status.INVALID_ARGUMENT, 'Invalid email address');
    if (!dto.password || dto.password.length < 8) throw rpcError(status.INVALID_ARGUMENT, 'Password must be at least 8 characters');
    if (!dto.name?.trim()) throw rpcError(status.INVALID_ARGUMENT, 'Name is required');
    if (await this.prisma.user.findUnique({ where: { email } })) throw rpcError(status.ALREADY_EXISTS, 'Email already registered');

    let user;
    try {
      user = await this.prisma.user.create({ data: { email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 12) } });
    } catch (e) {
      if (isPrismaCode(e, 'P2002')) throw rpcError(status.ALREADY_EXISTS, 'Email already registered');
      throw e;
    }
    this.log.log(`User registered: ${user.id}`);
    await this.events.publish(Topics.USER_CREATED, user.id, { userId: user.id, email: user.email })
      .catch((e) => this.log.error(`Failed to publish user.created: ${e.message}`));
    return { token: this.sign(user), user: this.toDto(user) };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: (dto.email ?? '').trim().toLowerCase() } });
    // Same error for unknown email and wrong password: no account enumeration.
    if (!user || !(await bcrypt.compare(dto.password ?? '', user.passwordHash))) {
      throw rpcError(status.UNAUTHENTICATED, 'Invalid credentials');
    }
    this.log.log(`User logged in: ${user.id}`);
    return { token: this.sign(user), user: this.toDto(user) };
  }

  validateToken({ token }: { token: string }) {
    try {
      const p = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      return { valid: true, userId: p.sub as string, email: p.email as string, role: p.role as string };
    } catch {
      return { valid: false, userId: '', email: '', role: '' };
    }
  }

  async getUser({ id }: { id: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw rpcError(status.NOT_FOUND, 'User not found');
    return this.toDto(user);
  }

  private sign(u: { id: string; email: string; role: string }) {
    return jwt.sign({ email: u.email, role: u.role }, this.secret, {
      subject: u.id, algorithm: 'HS256', expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as jwt.SignOptions['expiresIn'],
    });
  }
  private toDto(u: { id: string; email: string; name: string; role: string; createdAt: Date }) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt.toISOString() };
  }
}
