'use client';
import { useQuery } from '@apollo/client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ErrorState, PageTitle, Pagination, Skeleton } from '@/components/ui';
import { CATEGORIES, PRODUCTS } from '@/lib/graphql';
import { errorMessage } from '@/lib/utils';

const PAGE_SIZE = 12;
function Catalogue() {
  const params = useSearchParams(); const search = params.get('q') ?? '';
  const [categoryId, setCategoryId] = useState(params.get('category') ?? ''); const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, categoryId]);
  const cats = useQuery(CATEGORIES);
  const { data, loading, error, refetch } = useQuery(PRODUCTS, { variables: { search: search || undefined, categoryId: categoryId || undefined, page, pageSize: PAGE_SIZE } });
  const chip = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${active ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white ring-slate-200 hover:bg-indigo-50'}`;
  return <>
    <PageTitle>{search ? `Results for “${search}”` : 'All products'}</PageTitle>
    <div className="mb-6 flex flex-wrap gap-2"><button className={chip(!categoryId)} onClick={() => setCategoryId('')}>All</button>
      {cats.data?.categories?.map((c: { id: string; name: string }) => <button key={c.id} className={chip(categoryId === c.id)} onClick={() => setCategoryId(c.id)}>{c.name}</button>)}</div>
    {loading && !data ? <Skeleton /> : error && !data ? <ErrorState message={errorMessage(error)} retry={() => refetch()} /> :
      !data?.products.products.length ? <EmptyState title="No products found" hint="Try a different search or category." href="/products" cta="Clear filters" /> :
      <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.products.products.map((p: any) => <ProductCard key={p.id} p={p} />)}</div>
        <Pagination page={page} total={data.products.total} pageSize={PAGE_SIZE} onPage={setPage} /></>}
  </>;
}
export default function ProductsPage() { return <Suspense fallback={<Skeleton />}><Catalogue /></Suspense>; }
