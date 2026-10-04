'use client';
import { useMutation } from '@apollo/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { REGISTER } from '@/lib/graphql';
import { useAuth, useToast } from '@/lib/providers';
import { errorMessage, validateRegister } from '@/lib/utils';

export default function Register() {
  const [v, setV] = useState({ name: '', email: '', password: '' }); const [errors, setErrors] = useState<Record<string, string>>({});
  const [register, { loading }] = useMutation(REGISTER); const { signIn } = useAuth(); const router = useRouter(); const toast = useToast();
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const errs = validateRegister(v); setErrors(errs); if (Object.keys(errs).length) return;
    try { const { data } = await register({ variables: { input: v } }); signIn(data.register); toast('Account created. Welcome!'); router.push('/products'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  };
  return <div className="mx-auto max-w-md"><Card>
    <h1 className="mb-4 text-2xl font-bold">Create account</h1>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Name" autoComplete="name" value={v.name} error={errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <Field label="Email" type="email" autoComplete="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      <Field label="Password (min 8 characters)" type="password" autoComplete="new-password" value={v.password} error={errors.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating…' : 'Sign up'}</Button></form>
    <p className="mt-4 text-sm text-slate-500">Already registered? <Link href="/login" className="text-indigo-600 hover:underline">Log in</Link></p>
  </Card></div>;
}
