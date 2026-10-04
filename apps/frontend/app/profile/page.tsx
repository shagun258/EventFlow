'use client';
import { useMutation, useQuery } from '@apollo/client';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, PageTitle, Spinner } from '@/components/ui';
import { ME, MARK_READ, NOTIFICATIONS } from '@/lib/graphql';
import { useRequireAuth, useToast } from '@/lib/providers';
import { errorMessage, when } from '@/lib/utils';

export default function Profile() {
  const { allowed } = useRequireAuth(); const toast = useToast();
  const me = useQuery(ME, { skip: !allowed }); const n = useQuery(NOTIFICATIONS, { skip: !allowed, pollInterval: 10000 });
  const [mark] = useMutation(MARK_READ, { refetchQueries: ['Notifications'] });
  if (!allowed || (me.loading && !me.data)) return <Spinner />;
  if (me.error && !me.data) return <ErrorState message={errorMessage(me.error)} retry={() => me.refetch()} />;
  const u = me.data.me; const list = n.data?.notifications;
  return <><PageTitle>Profile</PageTitle><div className="grid gap-6 lg:grid-cols-3">
    <Card className="h-fit space-y-2 text-sm"><p className="text-lg font-semibold">{u.name}</p><p>{u.email}</p><p><Badge status={u.role} /></p><p className="text-slate-500">Member since {new Date(u.createdAt).toLocaleDateString()}</p><Link href="/orders" className="block pt-2 text-indigo-600 hover:underline">View orders →</Link></Card>
    <div className="lg:col-span-2"><h2 className="mb-3 font-semibold">Notifications {list?.unreadCount ? <span className="ml-1 rounded-full bg-indigo-600 px-2 text-xs text-white">{list.unreadCount} new</span> : null}</h2>
      {!list?.notifications.length ? <EmptyState title="No notifications yet" hint="Order updates will appear here, delivered via Kafka events." /> :
        <ul className="space-y-2">{list.notifications.map((x: any) => <li key={x.id}><Card className={`flex items-start justify-between gap-3 ${x.read ? 'opacity-60' : 'border-l-4 border-indigo-500'}`}>
          <div><p className="text-sm">{x.message}</p><p className="mt-1 text-xs text-slate-400">{when(x.createdAt)}{x.orderId && <> · <Link href={`/orders/${x.orderId}`} className="text-indigo-600 hover:underline">view order</Link></>}</p></div>
          {!x.read && <Button variant="secondary" onClick={() => mark({ variables: { id: x.id } }).catch((e) => toast(errorMessage(e), 'error'))}>Mark read</Button>}</Card></li>)}</ul>}</div></div></>;
}
