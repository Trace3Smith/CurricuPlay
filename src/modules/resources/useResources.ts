import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../app/api';
import type { ResourceLibrary } from '../../../shared/contracts/resources';

export function useResources(id?: string) {
  const [data, setData] = useState<ResourceLibrary | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const path = `/resources${id ? `/${id}` : ''}`;
  const reload = useCallback(async (signal?: AbortSignal) => {
    const next = await api<ResourceLibrary>(path, 'GET', undefined, signal);
    if (!signal?.aborted) setData(next);
  }, [path]);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setError('');
    void reload(abort.signal).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [reload]);
  async function run<T>(work: () => Promise<T>, message: string): Promise<T | undefined> {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    let result: T | undefined; let saved = false;
    try { result = await work(); saved = true; await reload(); setNotice(message); }
    catch (e) { setError(saved ? 'Saved, but refreshed records could not be loaded. Reload before making another change.' : (e as Error).message); }
    finally { pending.current = false; setBusy(false); }
    return saved ? result : undefined;
  }
  return { data, error, notice, busy, run, retry: () => { setError(''); void reload().catch(e => setError(e.message)); } };
}
export type ResourceState = ReturnType<typeof useResources>;
