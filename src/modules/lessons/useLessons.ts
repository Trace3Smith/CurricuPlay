import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../app/api';
import type { LessonLibrary } from '../../../shared/contracts/lessons';

export function useLessons() {
  const [data, setData] = useState<LessonLibrary | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const result = await api<LessonLibrary>('/lessons', 'GET', undefined, signal);
    if (!signal?.aborted) setData(result);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void reload(abort.signal).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [reload]);
  async function run<T>(work: () => Promise<T>, message: string, target: string | null = null): Promise<T | undefined> {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice(''); setFeedbackTarget(target);
    let result: T | undefined; let saved = false;
    try { result = await work(); saved = true; await reload(); setNotice(message); }
    catch (e) { setError(saved ? 'Saved, but refreshed lessons could not be loaded. Reload lessons before making another change.' : (e as Error).message); }
    finally { pending.current = false; setBusy(false); }
    return saved ? result : undefined;
  }
  async function retry() {
    if (pending.current) return;
    setError(''); setNotice(''); setFeedbackTarget(null);
    try { await reload(); setGeneration(n => n + 1); } catch (e) { setError((e as Error).message); }
  }
  return { data, error, notice, feedbackTarget, busy, run, retry, generation };
}
export type LessonState = ReturnType<typeof useLessons>;
