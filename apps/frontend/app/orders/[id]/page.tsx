'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, ErrorState, Modal, PageTitle, Spinner } from '@/components/ui';
import { CANCEL_ORDER, ORDER } from '@/lib/graphql';
import { useRequireAuth, useToast } from '@/lib/providers';
import { canCancel, errorMessage, money, when } from '@/lib/utils';

const STEPS = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'];
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>(); const { allowed } = useRequireAuth(); const toast = useToast(); const [confirm, setConfirm] = useState(false);
  const { data, loading, error, refetch } = useQuery(ORDER, { variables: { id }, skip: !allowed, pollInterval: 3000 });
  const [cancel, { loading: cancelling }] = useMutation(CANCEL_ORDER, { refetchQueries: ['Orders'] });
  if (!allowed || (loading && !data)) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const o = data.order; const idx = STEPS.indexOf(o.status);
  const doCancel = async () => { try { await cancel({ variables: { id, reason: 'Cancelled by customer' } }); toast('Order cancelled'); } catch (e) { toast(errorMessage(e), 'error'); } setConfirm(false); };
  return <><Link href="/orders" className="text-sm text-indigo-600 hover:underline">← All orders</Link>
    <PageTitle action={<Badge status={o.status} />}>{o.orderNumber}</PageTitle>
    <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
      <Card><h2 className="mb-3 font-semibold">Progress</h2>
        {idx >= 0 ? <ol className="flex items-center">{STEPS.map((s, i) => <li key={s} className="flex flex-1 flex-col items-center text-center text-xs"><span className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full font-bold ${i <= idx ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>{s}</li>)}</ol>
          : <p className="text-sm text-slate-600">This order ended as <b>{o.status.replace('_', ' ')}</b>{o.failureReason ? `: ${o.failureReason}` : ''}. Reserved stock was released.</p>}
        {o.status === 'PENDING' && <p className="mt-3 text-sm text-slate-500">Waiting for the (simulated) payment. This page updates automatically.</p>}</Card>
      <Card><h2 className="mb-3 font-semibold">Items</h2><ul className="divide-y divide-slate-100 text-sm">{o.items.map((i: any) => <li key={i.productId} className="flex justify-between py-2"><span>{i.quantity} × {i.productName} <span className="text-slate-400">@ {money(i.unitPrice)}</span></span><span>{money(i.quantity * i.unitPrice)}</span></li>)}</ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{money(o.total)}</span></div></Card></div>
    <Card className="h-fit space-y-2 text-sm"><p><span className="text-slate-500">Placed:</span> {when(o.createdAt)}</p><p><span className="text-slate-500">Updated:</span> {when(o.updatedAt)}</p>
      <p><span className="text-slate-500">Payment (simulated):</span> {o.paymentStatus ? <Badge status={o.paymentStatus} /> : '–'}</p>
      {canCancel(o.status) && <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirm(true)}>Cancel order</Button>}</Card></div>
    {confirm && <Modal title="Cancel this order?" onClose={() => setConfirm(false)}><p className="text-sm text-slate-600">Reserved items go back to stock{o.status === 'PAID' ? ' and your (simulated) payment is refunded' : ''}.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(false)}>Keep order</Button><Button variant="danger" onClick={doCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Yes, cancel'}</Button></div></Modal>}</>;
}
