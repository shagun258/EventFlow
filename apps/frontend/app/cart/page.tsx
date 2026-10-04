'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { Button, Card, EmptyState, ErrorState, PageTitle, Spinner } from '@/components/ui';
import { CART, REMOVE_FROM_CART, UPDATE_CART } from '@/lib/graphql';
import { useRequireAuth, useToast } from '@/lib/providers';
import { errorMessage, money } from '@/lib/utils';

export default function CartPage() {
  const { allowed } = useRequireAuth(); const toast = useToast();
  const { data, loading, error, refetch } = useQuery(CART, { skip: !allowed });
  const [update, u] = useMutation(UPDATE_CART); const [remove, r] = useMutation(REMOVE_FROM_CART);
  if (!allowed || (loading && !data)) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const cart = data?.cart; const busy = u.loading || r.loading;
  const setQty = (productId: string, quantity: number) => update({ variables: { input: { productId, quantity } } }).catch((e) => toast(errorMessage(e), 'error'));
  const del = (productId: string) => remove({ variables: { productId } }).then(() => toast('Item removed')).catch((e) => toast(errorMessage(e), 'error'));
  if (!cart?.items.length) return <><PageTitle>Your cart</PageTitle><EmptyState title="Your cart is empty" hint="Add something you like." href="/products" cta="Browse products" /></>;
  const blocked = cart.items.some((i: any) => i.unavailable);
  return <><PageTitle>Your cart</PageTitle><div className="grid gap-6 lg:grid-cols-3">
    <div className="space-y-3 lg:col-span-2">{cart.items.map((i: any) => <Card key={i.productId} className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1"><p className="font-semibold">{i.productName}</p>{i.unavailable ? <p className="text-sm text-red-600">No longer available. Please remove it.</p> : <p className="text-sm text-slate-500">{money(i.unitPrice)} each</p>}</div>
      {!i.unavailable && <input type="number" min={1} max={100} defaultValue={i.quantity} aria-label={`Quantity for ${i.productName}`} disabled={busy} className="w-20 rounded-lg border border-slate-300 px-3 py-2"
        onBlur={(e) => { const q = Math.min(100, Math.max(1, Number(e.target.value) || 1)); if (q !== i.quantity) void setQty(i.productId, q); }} />}
      <span className="w-24 text-right font-semibold">{money(i.lineTotal)}</span>
      <Button variant="secondary" disabled={busy} onClick={() => del(i.productId)}>Remove</Button></Card>)}</div>
    <Card className="h-fit"><h2 className="font-semibold">Summary</h2>
      <div className="mt-3 flex justify-between text-sm"><span>Items</span><span>{cart.itemCount}</span></div>
      <div className="mt-1 flex justify-between text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div>
      {blocked ? <p className="mt-4 text-sm text-red-600">Remove unavailable items to continue.</p> : <Link href="/checkout" className="mt-4 block rounded-lg bg-indigo-600 py-2.5 text-center font-medium text-white hover:bg-indigo-700">Proceed to checkout</Link>}</Card></div></>;
}
