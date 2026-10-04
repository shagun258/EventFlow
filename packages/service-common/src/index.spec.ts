import { Metadata } from '@grpc/grpc-js';
import * as jwt from 'jsonwebtoken';
process.env.JWT_SECRET = 'test-secret';
import { requireAdmin, requireUser } from './index';

const md = (t?: string) => { const m = new Metadata(); if (t) m.set('authorization', `Bearer ${t}`); return m; };
const sign = (role: string, secret = 'test-secret') => jwt.sign({ email: 'a@b.c', role }, secret, { subject: 'u1' });
const codeOf = (fn: () => unknown) => { try { fn(); } catch (e: any) { return e.getError().code; } return null; };

describe('auth helpers', () => {
  it('extracts the user from a valid token', () => expect(requireUser(md(sign('USER')))).toEqual({ id: 'u1', email: 'a@b.c', role: 'USER' }));
  it('rejects missing/forged tokens with UNAUTHENTICATED (16)', () => {
    expect(codeOf(() => requireUser(md()))).toBe(16);
    expect(codeOf(() => requireUser(md(sign('ADMIN', 'wrong'))))).toBe(16);
  });
  it('requireAdmin: USER gets PERMISSION_DENIED (7), ADMIN passes', () => {
    expect(codeOf(() => requireAdmin(md(sign('USER'))))).toBe(7);
    expect(requireAdmin(md(sign('ADMIN'))).role).toBe('ADMIN');
  });
});
