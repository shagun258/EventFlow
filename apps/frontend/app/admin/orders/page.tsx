'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, PageTitle, Pagination, Select, Spinner, Table } from '@/components/ui';
import { ADMIN_ORDERS, UPDATE_ORDER_STATUS } from '@/lib/graphql';
import { useToast } from '@/lib/providers';
import { errorMessage, money, nextStatus, when } from '@/lib/utils';

const FILTERS = ['', 'PENDING', 'PAID', 'PAYMENT_FAILED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
export default function AdminOrders() {
  const toast = useToast(); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(ADMIN_ORDERS, { variables: { status: status || undefined, page, pageSize: 10 }, pollInterval: 10000 });
  const [advance, { loading: busy }] = useMutation(UPDATE_ORDER_STATUS, { refetchQueries: ['AdminOrders'] });
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const orders = data.adminOrders.orders;
  return <><PageTitle action={<Select value={status} aria-label="Filter by status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>{FILTERS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}</Select>}>Orders</PageTitle>
    {!orders.length ? <EmptyState title="No orders match" /> : <><Table head={['Order', 'Date', 'Total', 'Status', '']}>{orders.map((o: any) => { const next = nextStatus(o.status); return <tr key={o.id}>
      <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">{o.orderNumber}</Link></td><td className="px-4 py-3">{when(o.createdAt)}</td><td className="px-4 py-3">{money(o.total)}</td><td className="px-4 py-3"><Badge status={o.status} /></td>
      <td className="px-4 py-3 text-right">{next && <Button variant="secondary" disabled={busy} onClick={() => advance({ variables: { id: o.id, status: next } }).then(() => toast(`Marked ${next}`)).catch((e) => toast(errorMessage(e), 'error'))}>Mark {next.toLowerCase()}</Button>}</td></tr>; })}</Table>
      <Pagination page={page} total={data.adminOrders.total} pageSize={10} onPage={setPage} /></>}</>;
}
