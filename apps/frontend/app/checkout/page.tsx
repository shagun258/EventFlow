'use client';
import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { Button, Card, EmptyState, ErrorState, PageTitle, Spinner } from '@/components/ui';
import { CART, CREATE_ORDER } from '@/lib/graphql';
import { useRequireAuth, useToast } from '@/lib/providers';
import { errorMessage, money } from '@/lib/utils';

export default function Checkout() {
  const { allowed } = useRequireAuth(); const router = useRouter(); const toast = useToast();
  const { data, loading, error, refetch } = useQuery(CART, { skip: !allowed });
  const [createOrder, { loading: placing }] = useMutation(CREATE_ORDER, { refetchQueries: ['Cart', 'Orders'] });
  if (!allowed || (loading && !data)) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const cart = data?.cart;
  if (!cart?.items.length) return <><PageTitle>Checkout</PageTitle><EmptyState title="Nothing to check out" href="/products" cta="Browse products" /></>;
  const place = async () => {
    try { const { data: d } = await createOrder(); toast(`Order ${d.createOrder.orderNumber} placed!`); router.push(`/orders/${d.createOrder.id}`); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };
  return <><PageTitle>Checkout</PageTitle><div className="mx-auto max-w-2xl"><Card>
    <h2 className="font-semibold">Order summary</h2>
    <ul className="mt-3 divide-y divide-slate-100 text-sm">{cart.items.map((i: any) => <li key={i.productId} className="flex justify-between py-2"><span>{i.quantity} × {i.productName}</span><span>{money(i.lineTotal)}</span></li>)}</ul>
    <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div>
    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Payment is <b>simulated</b>. No card is needed and no money moves. Orders over $1,000 are declined on purpose so you can see the failure flow.</p>
    <Button className="mt-4 w-full" onClick={place} disabled={placing}>{placing ? 'Placing order…' : `Place order · ${money(cart.total)}`}</Button></Card></div></>;
}
