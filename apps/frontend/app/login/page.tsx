'use client';
import { useMutation } from '@apollo/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { LOGIN } from '@/lib/graphql';
import { useAuth, useToast } from '@/lib/providers';
import { errorMessage, validateLogin } from '@/lib/utils';

export default function Login() {
  const [v, setV] = useState({ email: '', password: '' }); const [errors, setErrors] = useState<Record<string, string>>({});
  const [login, { loading }] = useMutation(LOGIN); const { signIn } = useAuth(); const router = useRouter(); const toast = useToast();
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const errs = validateLogin(v); setErrors(errs); if (Object.keys(errs).length) return;
    try { const { data } = await login({ variables: { input: v } }); signIn(data.login); toast(`Welcome back, ${data.login.user.name}!`); router.push(data.login.user.role === 'ADMIN' ? '/admin' : '/products'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  };
  return <div className="mx-auto max-w-md"><Card>
    <h1 className="mb-4 text-2xl font-bold">Log in</h1>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" type="email" autoComplete="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      <Field label="Password" type="password" autoComplete="current-password" value={v.password} error={errors.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Signing in…' : 'Log in'}</Button></form>
    <p className="mt-4 text-sm text-slate-500">New here? <Link href="/register" className="text-indigo-600 hover:underline">Create an account</Link></p>
    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Demo logins: <b>demo@eventflow.dev</b> / Demo@12345 · <b>admin@eventflow.dev</b> / Admin@12345</div>
  </Card></div>;
}
