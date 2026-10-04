export interface SessionUser { id: string; email: string; name: string; role: string }
export interface Session { token: string; user: SessionUser }
const KEY = 'ef_session';
// NOTE: localStorage keeps the demo simple. Production apps should prefer httpOnly cookies (XSS-safe) + CSRF protection.
export function getSession(): Session | null {
  try { return typeof window === 'undefined' ? null : JSON.parse(window.localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}
export const setSession = (s: Session) => { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } };
export const clearSession = () => { try { window.localStorage.removeItem(KEY); } catch { /* storage blocked */ } };
