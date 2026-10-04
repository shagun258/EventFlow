'use client';
import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { EmptyState, ErrorState, PageTitle, Pagination, Select, Spinner, Table } from '@/components/ui';
import { EVENTS } from '@/lib/graphql';
import { errorMessage, TOPICS, when } from '@/lib/utils';

export default function AdminEvents() {
  const [topic, setTopic] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(EVENTS, { variables: { topic: topic || undefined, page, pageSize: 15 }, pollInterval: 5000 });
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const events = data.events.events;
  return <><PageTitle action={<Select value={topic} aria-label="Filter by topic" onChange={(e) => { setTopic(e.target.value); setPage(1); }}><option value="">All topics</option>{TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>}>Event stream</PageTitle>
    {!events.length ? <EmptyState title="No events yet" hint="Place an order to generate events." /> : <><Table head={['Time', 'Topic', 'Producer', 'Entity', 'Payload']}>{events.map((e: any) => <tr key={e.eventId} className="align-top">
      <td className="whitespace-nowrap px-4 py-3">{when(e.occurredAt)}</td><td className="px-4 py-3 font-mono text-xs">{e.topic}</td><td className="px-4 py-3">{e.source}</td><td className="px-4 py-3 font-mono text-xs">{e.entityId?.slice(0, 8)}</td>
      <td className="px-4 py-3"><details><summary className="cursor-pointer text-indigo-600">View</summary><pre className="mt-2 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(JSON.parse(e.payloadJson), null, 2)}</pre></details></td></tr>)}</Table>
      <Pagination page={page} total={data.events.total} pageSize={15} onPage={setPage} /></>}</>;
}
