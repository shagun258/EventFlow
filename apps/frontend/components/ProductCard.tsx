'use client';
import { useMutation } from '@apollo/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ADD_TO_CART } from '@/lib/graphql';
import { useAuth, useToast } from '@/lib/providers';
import { errorMessage, money } from '@/lib/utils';
import { Button } from './ui';

export interface Product { id: string; name: string; description: string; price: number; imageUrl?: string | null; categoryId: string; categoryName: string }

export const Thumb = ({ p, className = 'h-40' }: { p: Product; className?: string }) =>
  p.imageUrl ? <img src={p.imageUrl} alt={p.name} className={`${className} w-full rounded-t-xl object-cover`} />
    : <div className={`${className} flex w-full items-center justify-center rounded-t-xl bg-gradient-to-br from-indigo-100 to-violet-200 text-4xl font-bold text-indigo-400`}>{p.name[0]}</div>;

export function ProductCard({ p }: { p: Product }) {
  const { user } = useAuth(); const router = useRouter(); const toast = useToast();
  const [add, { loading }] = useMutation(ADD_TO_CART, { refetchQueries: ['Cart'] });
  const onAdd = async () => {
    if (!user) return router.push('/login');
    try { await add({ variables: { input: { productId: p.id, quantity: 1 } } }); toast(`${p.name} added to cart`); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return <div className="flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
    <Link href={`/products/${p.id}`}><Thumb p={p} /></Link>
    <div className="flex flex-1 flex-col p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">{p.categoryName}</span>
      <Link href={`/products/${p.id}`} className="mt-1 font-semibold hover:underline">{p.name}</Link>
      <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{p.description}</p>
      <div className="mt-3 flex items-center justify-between"><span className="text-lg font-bold">{money(p.price)}</span><Button onClick={onAdd} disabled={loading}>{loading ? 'Adding…' : 'Add'}</Button></div>
    </div></div>;
}
