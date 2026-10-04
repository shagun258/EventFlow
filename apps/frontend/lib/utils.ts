export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
export const when = (iso: string) => new Date(iso).toLocaleString();

export const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', PAID: 'bg-emerald-100 text-emerald-800', PAYMENT_FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-200 text-slate-700', REJECTED: 'bg-red-100 text-red-800', SHIPPED: 'bg-blue-100 text-blue-800', DELIVERED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-red-100 text-red-800', PROCESSING: 'bg-amber-100 text-amber-800', REFUNDED: 'bg-purple-100 text-purple-800',
};
export const canCancel = (status: string) => status === 'PENDING' || status === 'PAID';
export const nextStatus = (status: string): 'SHIPPED' | 'DELIVERED' | null => (status === 'PAID' ? 'SHIPPED' : status === 'SHIPPED' ? 'DELIVERED' : null);

export const TOPICS = ['user.created', 'order.created', 'order.cancelled', 'order.status_updated', 'payment.created', 'payment.completed', 'payment.failed',
  'inventory.reserved', 'inventory.released', 'product.created', 'product.updated', 'notification.created'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Errors = Record<string, string>;
export function validateLogin(v: { email: string; password: string }): Errors {
  const e: Errors = {};
  if (!EMAIL.test(v.email)) e.email = 'Enter a valid email address';
  if (!v.password) e.password = 'Password is required';
  return e;
}
export function validateRegister(v: { name: string; email: string; password: string }): Errors {
  const e = validateLogin(v);
  if (!v.name.trim()) e.name = 'Name is required';
  if (v.password && v.password.length < 8) e.password = 'Use at least 8 characters';
  if (v.password.length > 72) e.password = 'Use at most 72 characters';
  return e;
}

/** Turns Apollo/network errors into a readable, safe message. */
export function errorMessage(err: unknown): string {
  const e = err as { graphQLErrors?: { message: string; extensions?: any }[]; networkError?: unknown; message?: string };
  const g = e?.graphQLErrors?.[0];
  if (g) { const orig = g.extensions?.originalError?.message; return Array.isArray(orig) ? orig.join('. ') : g.message; }
  if (e?.networkError) return 'Cannot reach the server. Is the API gateway running?';
  return e?.message ?? 'Something went wrong';
}
