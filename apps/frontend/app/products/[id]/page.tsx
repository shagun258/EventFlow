'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Thumb } from '@/components/ProductCard';
import { Button, ErrorState, Spinner } from '@/components/ui';
import { ADD_TO_CART, PRODUCT } from '@/lib/graphql';
import { useAuth, useToast } from '@/lib/providers';
import { errorMessage, money } from '@/lib/utils';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>(); const { user } = useAuth(); const router = useRouter(); const toast = useToast(); const [qty, setQty] = useState(1);
  const { data, loading, error, refetch } = useQuery(PRODUCT, { variables: { id } });
  const [add, { loading: adding }] = useMutation(ADD_TO_CART, { refetchQueries: ['Cart'] });
  if (loading && !data) return <Spinner />;
  if (error || !data?.product) return <ErrorState message={error ? errorMessage(error) : 'Product not found'} retry={error ? () => refetch() : undefined} />;
  const p = data.product;
  const onAdd = async () => {
    if (!user) return router.push('/login');
    try { await add({ variables: { input: { productId: p.id, quantity: qty } } }); toast(`${qty} × ${p.name} added to cart`); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return <div className="grid gap-8 md:grid-cols-2">
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200"><Thumb p={p} className="h-80" /></div>
    <div><Link href="/products" className="text-sm text-indigo-600 hover:underline">← All products</Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-600">{p.categoryName}</p>
      <h1 className="mt-1 text-3xl font-bold">{p.name}</h1><p className="mt-3 text-slate-600">{p.description}</p>
      <p className="mt-4 text-3xl font-bold">{money(p.price)}</p>
      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm font-medium" htmlFor="qty">Quantity</label>
        <input id="qty" type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className="w-20 rounded-lg border border-slate-300 px-3 py-2" />
        <Button onClick={onAdd} disabled={adding}>{adding ? 'Adding…' : 'Add to cart'}</Button></div>
      <p className="mt-4 text-xs text-slate-400">Stock is checked and reserved when you place the order.</p></div></div>;
}
