'use client';
import { useMutation, useQuery } from '@apollo/client';
import { FormEvent, useState } from 'react';
import { Button, ErrorState, Field, Modal, PageTitle, Spinner, Table } from '@/components/ui';
import { ADMIN_PRODUCTS, INVENTORY, UPDATE_INVENTORY } from '@/lib/graphql';
import { useToast } from '@/lib/providers';
import { errorMessage } from '@/lib/utils';

export default function AdminInventory() {
  const toast = useToast();
  const inv = useQuery(INVENTORY, { pollInterval: 10000 }); const prods = useQuery(ADMIN_PRODUCTS, { variables: { page: 1, pageSize: 100 } });
  const [update, { loading: saving }] = useMutation(UPDATE_INVENTORY, { refetchQueries: ['Inventory'] });
  const [edit, setEdit] = useState<{ id: string; name: string; qty: string } | null>(null);
  if ((inv.loading && !inv.data) || (prods.loading && !prods.data)) return <Spinner />;
  const err = inv.error ?? prods.error; if (err && !inv.data) return <ErrorState message={errorMessage(err)} retry={() => { void inv.refetch(); void prods.refetch(); }} />;
  const stock = new Map<string, any>((inv.data?.inventory.items ?? []).map((i: any) => [i.productId, i]));
  const save = async (e: FormEvent) => {
    e.preventDefault(); const quantity = Number(edit!.qty);
    if (!Number.isInteger(quantity) || quantity < 0) return toast('Enter a whole number, 0 or more', 'error');
    try { await update({ variables: { input: { productId: edit!.id, quantity } } }); toast('Stock updated'); setEdit(null); } catch (x) { toast(errorMessage(x), 'error'); }
  };
  return <><PageTitle>Inventory</PageTitle>
    <Table head={['Product', 'On hand', 'Reserved', 'Available', '']}>{(prods.data?.adminProducts.products ?? []).map((p: any) => { const s = stock.get(p.id); return <tr key={p.id}>
      <td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{s?.quantity ?? 0}</td><td className="px-4 py-3">{s?.reserved ?? 0}</td>
      <td className={`px-4 py-3 font-semibold ${(s?.available ?? 0) <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>{s?.available ?? 0}</td>
      <td className="px-4 py-3 text-right"><Button variant="secondary" onClick={() => setEdit({ id: p.id, name: p.name, qty: String(s?.quantity ?? 0) })}>Set stock</Button></td></tr>; })}</Table>
    <p className="mt-3 text-xs text-slate-500">Reserved units belong to unpaid orders. They return to stock if payment fails or the order is cancelled.</p>
    {edit && <Modal title={`Set stock: ${edit.name}`} onClose={() => setEdit(null)}><form onSubmit={save} className="space-y-4"><Field label="Units on hand" type="number" min="0" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} />
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={saving}>Save</Button></div></form></Modal>}</>;
}
