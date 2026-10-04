import { canCancel, errorMessage, money, nextStatus, validateLogin, validateRegister } from './utils';

describe('order helpers', () => {
  it('only PENDING and PAID orders can be cancelled (mirrors the backend rule)', () => {
    expect(['PENDING', 'PAID'].every(canCancel)).toBe(true);
    expect(['SHIPPED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'PAYMENT_FAILED'].some(canCancel)).toBe(false);
  });
  it('admin fulfilment advances PAID -> SHIPPED -> DELIVERED only', () => {
    expect(nextStatus('PAID')).toBe('SHIPPED'); expect(nextStatus('SHIPPED')).toBe('DELIVERED');
    expect(nextStatus('PENDING')).toBeNull(); expect(nextStatus('DELIVERED')).toBeNull();
  });
  it('formats money', () => expect(money(1234.5)).toBe('$1,234.50'));
});

describe('form validation', () => {
  it('login requires a valid email and a password', () => {
    expect(validateLogin({ email: 'nope', password: '' })).toEqual({ email: expect.any(String), password: expect.any(String) });
    expect(validateLogin({ email: 'a@b.com', password: 'x' })).toEqual({});
  });
  it('register enforces the same limits as the API (8-72 chars, name required)', () => {
    expect(validateRegister({ name: ' ', email: 'a@b.com', password: 'short' })).toMatchObject({ name: expect.any(String), password: expect.any(String) });
    expect(validateRegister({ name: 'A', email: 'a@b.com', password: 'x'.repeat(73) }).password).toBeDefined();
    expect(validateRegister({ name: 'Ann', email: 'ann@example.com', password: 'Secret@123' })).toEqual({});
  });
});

describe('errorMessage', () => {
  it('joins NestJS validation messages', () => {
    expect(errorMessage({ graphQLErrors: [{ message: 'Bad Request Exception', extensions: { originalError: { message: ['email must be an email', 'name too short'] } } }] })).toBe('email must be an email. name too short');
  });
  it('shows gateway business errors and a friendly network message', () => {
    expect(errorMessage({ graphQLErrors: [{ message: 'Insufficient stock for product p1' }] })).toBe('Insufficient stock for product p1');
    expect(errorMessage({ networkError: new Error('Failed to fetch') })).toMatch(/Cannot reach the server/);
  });
});
