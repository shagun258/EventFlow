'use client';
import { ApolloClient, ApolloLink, ApolloProvider, HttpLink, InMemoryCache, useApolloClient } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, getSession, Session, SessionUser, setSession } from './session';

// ---------- toasts ----------
type Toast = { id: number; msg: string; type: 'success' | 'error' };
const ToastCtx = createContext<(msg: string, type?: Toast['type']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, msg, type }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- auth ----------
interface AuthState { user: SessionUser | null; ready: boolean; signIn: (s: Session) => void; signOut: () => void }
const AuthCtx = createContext<AuthState>({ user: null, ready: false, signIn: () => undefined, signOut: () => undefined });
export const useAuth = () => useContext(AuthCtx);
function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setUser(getSession()?.user ?? null); setReady(true); }, []);
  const signIn = useCallback((s: Session) => { setSession(s); setUser(s.user); }, []);
  const signOut = useCallback(() => { clearSession(); setUser(null); void client.clearStore(); }, [client]);
  return <AuthCtx.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

/** Redirects anonymous visitors to /login. `allowed` is false for non-admins when admin=true (the API enforces this too). */
export function useRequireAuth(admin = false) {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  return { user, ready, allowed: !!user && (!admin || user.role === 'ADMIN') };
}

// ---------- apollo ----------
export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const http = new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql' });
    const auth = setContext((_, { headers }) => { const t = getSession()?.token; return { headers: { ...headers, ...(t ? { authorization: `Bearer ${t}` } : {}) } }; });
    const logoutOnExpiry = onError(({ graphQLErrors }) => {
      if (graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') && getSession()) { clearSession(); window.location.assign('/login'); }
    });
    return new ApolloClient({
      link: ApolloLink.from([logoutOnExpiry, auth, http]),
      cache: new InMemoryCache({ typePolicies: { Query: { fields: { cart: { merge: true } } } } }),
      defaultOptions: { watchQuery: { fetchPolicy: 'cache-and-network' } },
    });
  }, []);
  return <ApolloProvider client={client}><ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider></ApolloProvider>;
}
