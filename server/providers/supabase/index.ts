import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCookie, stringifySetCookie } from 'cookie';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, type AuthIdentity, type FoundationRepository, type RequestPorts } from '../../ports';
import type { Database } from './database';
import { assignmentFromRow, assignmentToRow, profileFromRow, workFromRow, yearFromRow } from './mapping';
import { supabaseResourcePorts } from './resources';
import { supabaseLessonRepository } from './lessons';

export interface SupabaseConfig { url: string; publishableKey: string; origin: string }
function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new AppError(409, 'A record with that name already exists.');
  if (['23503', '23514', '42501'].includes(error.code ?? '')) throw new AppError(403, 'This change is not permitted for the selected workspace or context.');
  throw new AppError(503, 'Your records could not be saved or loaded. Check the database setup and try again.');
}
function updated(result: { error: { code?: string } | null; data: unknown[] | null }) {
  databaseError(result.error);
  if (!result.data?.length) throw new AppError(409, 'This record changed in another tab. Reload and try again.');
}

export function supabaseRepository(client: SupabaseClient<Database>): FoundationRepository {
  return {
    async bootstrap() { databaseError((await client.rpc('bootstrap_teacher', {})).error); },
    async read(identity: AuthIdentity) {
      const user = await client.from('app_users').select('*').eq('auth_subject', identity.subject).single();
      databaseError(user.error);
      if (!user.data) throw new AppError(503, 'Your teacher account is not ready yet.');
      const profile = await client.from('teacher_profiles').select('*').eq('user_id', user.data.id).single();
      databaseError(profile.error);
      if (!profile.data) throw new AppError(503, 'Your teacher profile could not be loaded.');
      const workspaceId = profile.data.workspace_id;
      const [workspace, years, assignments, work] = await Promise.all([
        client.from('workspaces').select('*').eq('id', workspaceId).single(),
        client.from('school_years').select('*').eq('workspace_id', workspaceId).order('starts_on', { ascending: false }),
        client.from('teaching_assignments').select('*').eq('workspace_id', workspaceId).order('created_at'),
        client.from('work_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      ]);
      [workspace, years, assignments, work].forEach(result => databaseError(result.error));
      if (!workspace.data) throw new AppError(403, 'Your workspace is unavailable.');
      return { user: { id: user.data.id, email: identity.email }, profile: profileFromRow(profile.data), workspace: { id: workspace.data.id, name: workspace.data.name, kind: workspace.data.kind }, schoolYears: (years.data ?? []).map(yearFromRow), assignments: (assignments.data ?? []).map(assignmentFromRow), workItems: (work.data ?? []).map(workFromRow) };
    },
    async updateProfile(userId, value) { updated(await client.from('teacher_profiles').update({ display_name: value.displayName, timezone: value.timezone }).eq('user_id', userId).eq('revision', value.revision).select('user_id')); },
    async selectContext(userId, value) { updated(await client.from('teacher_profiles').update({ selected_school_year_id: value.schoolYearId, selected_assignment_id: value.assignmentId }).eq('user_id', userId).eq('revision', value.revision).select('user_id')); },
    async createYear(workspaceId, value) { databaseError((await client.from('school_years').insert({ workspace_id: workspaceId, name: value.name, starts_on: value.startsOn, ends_on: value.endsOn })).error); },
    async createAssignment(workspaceId, value) { databaseError((await client.from('teaching_assignments').insert(assignmentToRow(workspaceId, value))).error); },
    async createWork(workspaceId, userId, value) { databaseError((await client.from('work_items').insert({ workspace_id: workspaceId, created_by: userId, assignment_id: value.assignmentId, title: value.title, description: value.description, due_on: value.dueOn, priority: value.priority, source: 'manual' })).error); },
    async updateWork(workspaceId, id, value) { updated(await client.from('work_items').update({ status: value.status, completed_at: value.status === 'completed' ? new Date().toISOString() : null }).eq('workspace_id', workspaceId).eq('id', id).eq('revision', value.revision).select('id')); },
  };
}

/** Only server code imports the Supabase SDK. Browser code uses our HTTP contract. */
export function createSupabasePorts(req: IncomingMessage, res: ServerResponse, config: SupabaseConfig, transport?: typeof fetch): RequestPorts {
  const cookies = new Map(Object.entries(parseCookie(req.headers.cookie ?? '')).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const client = createServerClient<Database>(config.url, config.publishableKey, {
    ...(transport ? { global: { fetch: transport } } : {}),
    cookieOptions: { name: 'classthread-auth', httpOnly: true, sameSite: 'lax', secure: new URL(config.origin).protocol === 'https:', path: '/' },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: values => {
        const prior = res.getHeader('Set-Cookie');
        const headers = Array.isArray(prior) ? prior.map(String) : prior ? [String(prior)] : [];
        for (const { name, value, options } of values) {
          cookies.set(name, value);
          headers.push(stringifySetCookie({ name, value, ...options, httpOnly: true, sameSite: 'lax', secure: new URL(config.origin).protocol === 'https:', path: '/' }));
        }
        res.setHeader('Set-Cookie', headers);
      },
    },
  });
  return {
    ...supabaseResourcePorts(client),
    repository: supabaseRepository(client),
    lessons: supabaseLessonRepository(client),
    auth: {
      async currentUser() {
        const { data, error } = await client.auth.getUser();
        if (error) {
          if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) return null;
          throw new AppError(503, 'Sign-in is temporarily unavailable. Please try again.');
        }
        if (!data.user?.email || data.user.is_anonymous) return null;
        return { subject: data.user.id, email: data.user.email };
      },
      async startGoogle(redirectTo) {
        const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, scopes: 'openid email profile', skipBrowserRedirect: true } });
        if (error || !data.url) throw new AppError(503, 'Google sign-in is unavailable. Try your email instead.');
        return data.url;
      },
      async sendEmailCode(email) {
        const { error } = await client.auth.signInWithOtp({ email });
        if (error) throw new AppError(error.status === 429 ? 429 : 503, 'A sign-in code could not be sent. Wait a moment and try again.');
      },
      async verifyEmailCode(email, token) {
        const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw new AppError(400, 'That code is invalid or expired. Request a new code.');
      },
      async exchangeCode(code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw new AppError(400, 'Sign-in could not be completed. Please try again.');
      },
      async signOut() {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw new AppError(503, 'Sign-out could not be completed. Please try again.');
      },
    },
  };
}
