'use client';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { ErrorState, Skeleton } from '@/components/ui';
import { CATEGORIES, PRODUCTS } from '@/lib/graphql';
import { errorMessage } from '@/lib/utils';

export default function Home() {
  const cats = useQuery(CATEGORIES);
  const { data, loading, error, refetch } = useQuery(PRODUCTS, { variables: { page: 1, pageSize: 8 } });
  return <div className="space-y-10">
    <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white md:p-14">
      <h1 className="text-3xl font-bold md:text-5xl">Shop smarter with EventFlow</h1>
      <p className="mt-3 max-w-xl text-indigo-100">A demo store powered by microservices: every order flows through Kafka events, gRPC calls and a GraphQL gateway.</p>
      <Link href="/products" className="mt-6 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-indigo-700 hover:bg-indigo-50">Browse products</Link>
    </section>
    <section><h2 className="mb-3 text-lg font-semibold">Categories</h2>
      <div className="flex flex-wrap gap-2">{cats.data?.categories?.map((c: { id: string; name: string }) => <Link key={c.id} href={`/products?category=${c.id}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-slate-200 hover:bg-indigo-50">{c.name}</Link>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Latest products</h2>
      {loading && !data ? <Skeleton n={4} /> : error && !data ? <ErrorState message={errorMessage(error)} retry={() => refetch()} /> :
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{data?.products.products.map((p: any) => <ProductCard key={p.id} p={p} />)}</div>}</section>
  </div>;
}
