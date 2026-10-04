'use client';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, EmptyState, ErrorState, PageTitle, Pagination, Spinner, Table } from '@/components/ui';
import { ORDERS } from '@/lib/graphql';
import { useRequireAuth } from '@/lib/providers';
import { errorMessage, money, when } from '@/lib/utils';

export default function Orders() {
  const { allowed } = useRequireAuth(); const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(ORDERS, { variables: { page, pageSize: 10 }, skip: !allowed, pollInterval: 5000 }); // polls so status changes appear live
  if (!allowed || (loading && !data)) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const orders = data?.orders.orders ?? [];
  return <><PageTitle>Order history</PageTitle>
    {!orders.length ? <EmptyState title="No orders yet" hint="Your orders will show up here." href="/products" cta="Start shopping" /> :
      <><Table head={['Order', 'Date', 'Items', 'Total', 'Status']}>{orders.map((o: any) => <tr key={o.id} className="hover:bg-slate-50">
        <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">{o.orderNumber}</Link></td>
        <td className="px-4 py-3">{when(o.createdAt)}</td><td className="px-4 py-3">{o.items.reduce((s: number, i: any) => s + i.quantity, 0)}</td>
        <td className="px-4 py-3">{money(o.total)}</td><td className="px-4 py-3"><Badge status={o.status} /></td></tr>)}</Table>
        <Pagination page={page} total={data.orders.total} pageSize={10} onPage={setPage} /></>}</>;
}
