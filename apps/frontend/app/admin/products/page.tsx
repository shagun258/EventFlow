'use client';
import { useMutation, useQuery } from '@apollo/client';
import { FormEvent, useState } from 'react';
import { Product } from '@/components/ProductCard';
import { Button, EmptyState, ErrorState, Field, Modal, PageTitle, Pagination, Select, Spinner, Table } from '@/components/ui';
import { ADMIN_PRODUCTS, CATEGORIES, CREATE_PRODUCT, DELETE_PRODUCT, UPDATE_PRODUCT } from '@/lib/graphql';
import { useToast } from '@/lib/providers';
import { errorMessage, money } from '@/lib/utils';

const EMPTY = { name: '', description: '', price: '', imageUrl: '', categoryId: '' };
export default function AdminProducts() {
  const toast = useToast(); const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(ADMIN_PRODUCTS, { variables: { page, pageSize: 10 } }); const cats = useQuery(CATEGORIES);
  const [editing, setEditing] = useState<Product | 'new' | null>(null); const [form, setForm] = useState(EMPTY); const [deleting, setDeleting] = useState<Product | null>(null);
  const opts = { refetchQueries: ['AdminProducts', 'Products'] };
  const [create, c] = useMutation(CREATE_PRODUCT, opts); const [update, u] = useMutation(UPDATE_PRODUCT, opts); const [del, d] = useMutation(DELETE_PRODUCT, opts);
  const open = (p: Product | 'new') => { setForm(p === 'new' ? { ...EMPTY, categoryId: cats.data?.categories?.[0]?.id ?? '' } : { name: p.name, description: p.description, price: String(p.price), imageUrl: p.imageUrl ?? '', categoryId: p.categoryId }); setEditing(p); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); const price = Number(form.price);
    if (!form.name.trim() || !(price > 0) || !form.categoryId) return toast('Name, a price above 0 and a category are required', 'error');
    const input = { name: form.name.trim(), description: form.description, price, categoryId: form.categoryId, ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}) };
    try { if (editing === 'new') await create({ variables: { input } }); else await update({ variables: { id: (editing as Product).id, input } }); toast('Product saved'); setEditing(null); }
    catch (err) { toast(errorMessage(err), 'error'); }
  };
  const remove = async () => { try { await del({ variables: { id: deleting!.id } }); toast('Product deleted'); } catch (e) { toast(errorMessage(e), 'error'); } setDeleting(null); };
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState message={errorMessage(error)} retry={() => refetch()} />;
  const rows = data.adminProducts.products as Product[];
  return <><PageTitle action={<Button onClick={() => open('new')}>+ Add product</Button>}>Products</PageTitle>
    {!rows.length ? <EmptyState title="No products yet" /> : <><Table head={['Name', 'Category', 'Price', '']}>{rows.map((p) => <tr key={p.id}>
      <td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.categoryName}</td><td className="px-4 py-3">{money(p.price)}</td>
      <td className="space-x-2 px-4 py-3 text-right"><Button variant="secondary" onClick={() => open(p)}>Edit</Button><Button variant="danger" onClick={() => setDeleting(p)}>Delete</Button></td></tr>)}</Table>
      <Pagination page={page} total={data.adminProducts.total} pageSize={10} onPage={setPage} /></>}
    {editing && <Modal title={editing === 'new' ? 'Add product' : 'Edit product'} onClose={() => setEditing(null)}><form onSubmit={save} className="space-y-3" noValidate>
      <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Field label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Field label="Price (USD)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><Field label="Image URL (optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
      <label className="block text-sm"><span className="mb-1 block font-medium">Category</span><Select className="w-full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{cats.data?.categories?.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></label>
      <p className="text-xs text-slate-500">New products need stock: set it under Inventory.</p>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={c.loading || u.loading}>Save</Button></div></form></Modal>}
    {deleting && <Modal title="Delete product?" onClose={() => setDeleting(null)}><p className="text-sm">“{deleting.name}” will be removed from the catalogue. Existing orders keep their price snapshot.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" disabled={d.loading} onClick={remove}>Delete</Button></div></Modal>}</>;
}
