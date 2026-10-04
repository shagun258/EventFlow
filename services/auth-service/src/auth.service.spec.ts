import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
process.env.JWT_SECRET = 'test-secret';
import { AuthService } from './auth.service';

const users: any[] = [];
const prisma: any = { user: {
  findUnique: jest.fn(async ({ where }) => users.find((u) => u.email === where.email || u.id === where.id) ?? null),
  create: jest.fn(async ({ data }) => { const u = { id: 'u1', role: 'USER', createdAt: new Date(), ...data }; users.push(u); return u; }),
} };
const events: any = { publish: jest.fn().mockResolvedValue(undefined) };
const errCode = async (p: Promise<unknown>) => p.then(() => null, (e) => e.getError().code);

describe('AuthService', () => {
  let svc: AuthService;
  beforeEach(() => { users.length = 0; jest.clearAllMocks(); svc = new AuthService(prisma, events); });

  it('hashes the password and publishes user.created', async () => {
    const res = await svc.register({ email: 'A@Test.com', password: 'password123', name: 'Ann' });
    expect(users[0].email).toBe('a@test.com');
    expect(users[0].passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', users[0].passwordHash)).toBe(true);
    expect(res.user).not.toHaveProperty('passwordHash');
    expect(events.publish).toHaveBeenCalledWith('user.created', 'u1', { userId: 'u1', email: 'a@test.com' });
  });
  it('rejects duplicate email (ALREADY_EXISTS=6) and weak password (INVALID_ARGUMENT=3)', async () => {
    await svc.register({ email: 'a@test.com', password: 'password123', name: 'Ann' });
    expect(await errCode(svc.register({ email: 'a@test.com', password: 'password123', name: 'Ann' }))).toBe(6);
    expect(await errCode(svc.register({ email: 'b@test.com', password: 'short', name: 'Bob' }))).toBe(3);
  });
  it('logs in with valid credentials and issues a verifiable JWT with role', async () => {
    await svc.register({ email: 'a@test.com', password: 'password123', name: 'Ann' });
    const { token } = await svc.login({ email: 'a@test.com', password: 'password123' });
    const payload = jwt.verify(token, 'test-secret') as jwt.JwtPayload;
    expect(payload.sub).toBe('u1'); expect(payload.role).toBe('USER');
    expect(svc.validateToken({ token }).valid).toBe(true);
  });
  it('gives the same UNAUTHENTICATED error for wrong password and unknown user', async () => {
    await svc.register({ email: 'a@test.com', password: 'password123', name: 'Ann' });
    expect(await errCode(svc.login({ email: 'a@test.com', password: 'wrongpass1' }))).toBe(16);
    expect(await errCode(svc.login({ email: 'x@test.com', password: 'password123' }))).toBe(16);
  });
  it('rejects tampered tokens', () => {
    expect(svc.validateToken({ token: jwt.sign({ role: 'ADMIN' }, 'other-secret') }).valid).toBe(false);
  });
});
