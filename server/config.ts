import { createApiHandler } from './app';
import { createSupabasePorts } from './providers/supabase';

export function configuredApi(env: Record<string, string | undefined>) {
  const origin = env.CLASSTHREAD_ORIGIN ?? 'http://localhost:5173';
  const url = env.SUPABASE_URL ?? '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? '';
  const isProduction = env.NODE_ENV === 'production' || !!env.VERCEL;
  const validOrigin = new URL(origin).origin === origin && (!isProduction || origin.startsWith('https://'));
  const configured = !!url && !!publishableKey && validOrigin && (!isProduction || !!env.CLASSTHREAD_ORIGIN);
  return createApiHandler({ origin, configured, ports: (req, res) => createSupabasePorts(req, res, { url, publishableKey, origin }) });
}
