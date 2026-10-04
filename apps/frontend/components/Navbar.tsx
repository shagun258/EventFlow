'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { CART, LOGOUT, NOTIFICATIONS } from '@/lib/graphql';
import { useAuth, useToast } from '@/lib/providers';

export function Navbar() {
  const { user, signOut } = useAuth(); const router = useRouter(); const toast = useToast();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const { data: cart } = useQuery(CART, { skip: !user, pollInterval: 15000 });
  const { data: notif } = useQuery(NOTIFICATIONS, { skip: !user, pollInterval: 10000 });
  const [logout] = useMutation(LOGOUT);
  const count = cart?.cart?.itemCount ?? 0; const unread = notif?.notifications?.unreadCount ?? 0;
  const search = (e: FormEvent) => { e.preventDefault(); router.push(`/products?q=${encodeURIComponent(q.trim())}`); setOpen(false); };
  const doLogout = async () => { await logout().catch(() => undefined); signOut(); setOpen(false); toast('Signed out'); router.push('/'); };
  const link = 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
  const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="ml-1 rounded-full bg-indigo-600 px-1.5 text-xs text-white">{n}</span> : null);
  return <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
      <Link href="/" className="text-lg font-bold text-indigo-600">EventFlow</Link>
      <form onSubmit={search} className="order-3 w-full md:order-none md:max-w-md md:flex-1" role="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
      </form>
      <button className="ml-auto rounded-lg p-2 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      <div className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-1 md:ml-auto md:flex md:w-auto md:flex-row md:items-center`} onClick={() => setOpen(false)}>
        <Link href="/products" className={link}>Products</Link>
        {user ? <>
          <Link href="/cart" className={link}>🛒 Cart<Badge n={count} /></Link>
          <Link href="/orders" className={link}>Orders</Link>
          <Link href="/profile" className={link}>🔔<Badge n={unread} /> {user.name.split(' ')[0]}</Link>
          {user.role === 'ADMIN' && <Link href="/admin" className={`${link} text-indigo-600`}>Admin</Link>}
          <button onClick={doLogout} className={link}>Logout</button>
        </> : <><Link href="/login" className={link}>Login</Link><Link href="/register" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Sign up</Link></>}
      </div>
    </nav></header>;
}
