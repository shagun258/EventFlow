'use client';
import { useQuery } from '@apollo/client';
import { ErrorState, PageTitle, Spinner, StatCard, Card } from '@/components/ui';
import { ANALYTICS } from '@/lib/graphql';
import { errorMessage, money } from '@/lib/utils';

export default function Dashboard() {
  const { data, loading, error, refetch } = useQuery(ANALYTICS, { pollInterval: 10000 });
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const a = data.analytics; const max = Math.max(1, ...a.byTopic.map((t: any) => t.count));
  return <><PageTitle>Dashboard</PageTitle>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Net revenue (paid, not cancelled)" value={money(a.revenue)} tone="text-emerald-600" /><StatCard label="Orders created" value={a.ordersCreated} />
      <StatCard label="Payments completed" value={a.paymentsCompleted} /><StatCard label="Payments failed" value={a.paymentsFailed} tone={a.paymentsFailed ? 'text-red-600' : ''} /></div>
    <Card className="mt-6"><h2 className="mb-1 font-semibold">Kafka events by topic</h2><p className="mb-4 text-sm text-slate-500">{a.totalEvents} events recorded by the analytics service.</p>
      <ul className="space-y-2">{a.byTopic.map((t: any) => <li key={t.topic} className="text-sm"><div className="flex justify-between"><span className="font-mono">{t.topic}</span><span>{t.count}</span></div>
        <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-indigo-500" style={{ width: `${(t.count / max) * 100}%` }} /></div></li>)}</ul></Card></>;
}
