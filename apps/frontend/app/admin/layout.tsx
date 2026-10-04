'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ErrorState, Spinner } from '@/components/ui';
import { useRequireAuth } from '@/lib/providers';

const LINKS = [['/admin', 'Dashboard'], ['/admin/products', 'Products'], ['/admin/orders', 'Orders'], ['/admin/inventory', 'Inventory'], ['/admin/events', 'Events']];
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, ready, allowed } = useRequireAuth(true); const path = usePathname();
  if (!ready || !user) return <Spinner />;
  if (!allowed) return <ErrorState message="Admin access required. (The API enforces this too, not just this page.)" />;
  return <div className="grid gap-6 md:grid-cols-[200px_1fr]">
    <aside className="md:sticky md:top-24 md:h-fit"><nav className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 ring-1 ring-slate-200 md:flex-col" aria-label="Admin">
      {LINKS.map(([href, label]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${path === href ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</Link>)}</nav></aside>
    <section className="min-w-0">{children}</section></div>;
}
