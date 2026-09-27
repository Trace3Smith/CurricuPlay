import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FoundationData, SessionInfo } from '../../shared/contracts/foundation';
import { api, ApiError } from './api';

interface FoundationContext {
  session: SessionInfo | null; data: FoundationData | null; loading: boolean; busy: boolean; error: string; notice: string;
  reload: () => Promise<void>;
  mutate: (path: string, method: string, value: unknown, message: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}
const Context = createContext<FoundationContext | null>(null);
export function FoundationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [data, setData] = useState<FoundationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load(signal?: AbortSignal) {
    const current = await api<SessionInfo>('/session', 'GET', undefined, signal);
    const records = current.authenticated ? await api<FoundationData>('/foundation', 'GET', undefined, signal) : null;
    if (!signal?.aborted) { setSession(current); setData(records); }
  }
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch(error => { if (!abort.signal.aborted) setError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);
  async function reload() {
    setLoading(true); setError('');
    try { await load(); } catch (error) { setError((error as Error).message); } finally { setLoading(false); }
  }
  async function mutate(path: string, method: string, value: unknown, message: string) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      await api(path, method, value);
      saved = true;
      setData(await api<FoundationData>('/foundation'));
      setNotice(message);
      return true;
    } catch (error) {
      setError(saved ? 'Your change was saved, but refreshed records could not be loaded. Reload records before making another change.' : (error as Error).message);
      if (error instanceof ApiError && error.status === 401) { setData(null); setSession(current => current ? { ...current, authenticated: false } : null); }
      // Close a successfully submitted form even if the subsequent read failed.
      // Leaving it open would encourage accidental duplicate submissions.
      return saved;
    } finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      await api('/auth/sign-out', 'POST', {});
      setData(null); setSession(current => current ? { ...current, authenticated: false } : null); setNotice('Signed out. Browser Games data remains on this device.');
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <Context.Provider value={{ session, data, loading, busy, error, notice, reload, mutate, signOut }}>{children}</Context.Provider>;
}
export function useFoundation() {
  const context = useContext(Context);
  if (!context) throw new Error('FoundationProvider is required');
  return context;
}
