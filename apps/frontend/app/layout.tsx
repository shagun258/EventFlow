import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/lib/providers';
import './globals.css';

export const metadata: Metadata = { title: 'EventFlow Commerce', description: 'Event-driven e-commerce demo: Kafka, gRPC, GraphQL, microservices' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><Providers><Navbar /><main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    <footer className="py-8 text-center text-xs text-slate-400">EventFlow Commerce is a portfolio demo. Payments are simulated and no real money moves.</footer></Providers></body></html>;
}
