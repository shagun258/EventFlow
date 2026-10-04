import Link from 'next/link';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { STATUS_STYLES } from '@/lib/utils';

const VARIANTS = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700', secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50', danger: 'bg-red-600 text-white hover:bg-red-700' };
export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button {...p} className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`} />;
}
export const Spinner = () => <div className="flex justify-center py-16" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /></div>;
export const Skeleton = ({ n = 8 }: { n?: number }) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: n }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200" />)}</div>;
export function EmptyState({ title, hint, href, cta }: { title: string; hint?: string; href?: string; cta?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-medium">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}{href && <Link href={href} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">{cta}</Link>}</div>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"><p>{message}</p>{retry && <Button variant="secondary" className="mt-3" onClick={retry}>Try again</Button>}</div>;
}
export const Badge = ({ status }: { status: string }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'}`}>{status.replace('_', ' ')}</span>;
export const PageTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{children}</h1>{action}</div>;
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
export const StatCard = ({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) => <Card><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></Card>;

export function Field({ label, error, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><input {...p} aria-invalid={!!error} className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-slate-300'}`} />{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>;
}
export const Select = ({ className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${className}`} />;

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">&times;</button></div>{children}</div></div>;
}
export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <div className="mt-6 flex items-center justify-center gap-3 text-sm"><Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div>;
}
export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{head.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
