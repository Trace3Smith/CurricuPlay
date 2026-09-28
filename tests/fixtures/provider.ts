import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookie, stringifySetCookie } from 'cookie';
import { AppError, type AuthIdentity, type FoundationRepository, type RequestPorts } from '../../server/ports';
import { assignmentFromRow, assignmentToRow, profileFromRow, workFromRow, yearFromRow } from '../../server/providers/supabase/mapping';
import type { AssignmentRow, ProfileRow, UserRow, WorkRow, WorkspaceRow, YearRow } from '../../server/providers/supabase/database';
import { resourceRepository, resourceDatabaseError } from '../../server/providers/supabase/resources';
import type { FixtureDatabase } from './database';
import { lessonRepository, lessonDatabaseError } from '../../server/providers/supabase/lessons';

export function fixturePorts(database: FixtureDatabase) {
  const sessions = new Map<string, AuthIdentity>();
  return (req: IncomingMessage, res: ServerResponse): RequestPorts => {
    let token = parseCookie(req.headers.cookie ?? '').classthread_fixture;
    let user = token ? sessions.get(token) ?? null : null;
    async function query<T>(sql: string, values: unknown[] = []) {
      if (!user) throw new AppError(401, 'Please sign in.');
      try { return (await database.asUser(user.subject, tx => tx.query<T>(sql, values))).rows; }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (code === '23505') throw new AppError(409, 'A record with that name already exists.');
        if (['23503','23514','42501'].includes(code ?? '')) throw new AppError(403, 'This change is not permitted for the selected workspace or context.');
        throw error;
      }
    }
    async function insert(table: 'school_years' | 'teaching_assignments' | 'work_items', value: Record<string, unknown>) {
      const keys = Object.keys(value);
      await query(`insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(value));
    }
    async function update(sql: string, values: unknown[]) {
      if (!(await query(sql, values)).length) throw new AppError(409, 'This record changed in another tab. Reload and try again.');
    }
    const repository: FoundationRepository = {
      async bootstrap() { await query('select public.bootstrap_teacher()'); },
      async read(identity) {
        const account = (await query<UserRow>('select * from public.app_users where auth_subject=$1', [identity.subject]))[0];
        const profile = (await query<ProfileRow>('select * from public.teacher_profiles where user_id=$1', [account.id]))[0];
        const workspace = (await query<WorkspaceRow>('select * from public.workspaces where id=$1', [profile.workspace_id]))[0];
        const years = await query<YearRow>('select * from public.school_years where workspace_id=$1 order by starts_on desc', [workspace.id]);
        const assignments = await query<AssignmentRow>('select * from public.teaching_assignments where workspace_id=$1 order by created_at', [workspace.id]);
        const work = await query<WorkRow>('select * from public.work_items where workspace_id=$1 order by created_at desc', [workspace.id]);
        return { user: { id: account.id, email: identity.email }, profile: profileFromRow(profile), workspace: { id: workspace.id, name: workspace.name, kind: workspace.kind }, schoolYears: years.map(yearFromRow), assignments: assignments.map(assignmentFromRow), workItems: work.map(workFromRow) };
      },
      async updateProfile(id, value) { await update('update public.teacher_profiles set display_name=$1, timezone=$2 where user_id=$3 and revision=$4 returning user_id', [value.displayName, value.timezone, id, value.revision]); },
      async selectContext(id, value) { await update('update public.teacher_profiles set selected_school_year_id=$1, selected_assignment_id=$2 where user_id=$3 and revision=$4 returning user_id', [value.schoolYearId, value.assignmentId, id, value.revision]); },
      async createYear(workspaceId, value) { await insert('school_years', { workspace_id: workspaceId, name: value.name, starts_on: value.startsOn, ends_on: value.endsOn }); },
      async createAssignment(workspaceId, value) { await insert('teaching_assignments', assignmentToRow(workspaceId, value)); },
      async createWork(workspaceId, userId, value) { await insert('work_items', { workspace_id: workspaceId, created_by: userId, assignment_id: value.assignmentId, title: value.title, description: value.description, due_on: value.dueOn, priority: value.priority }); },
      async updateWork(workspaceId, id, value) { await update('update public.work_items set status=$1, completed_at=$2 where workspace_id=$3 and id=$4 and revision=$5 returning id', [value.status, value.status === 'completed' ? new Date().toISOString() : null, workspaceId, id, value.revision]); },
    };
    return {
      repository,
      lessons: lessonRepository(async (name, args) => {
        if (!user) throw new AppError(401, 'Please sign in.');
        try {
          const rows = await database.asUser(user.subject, tx => tx.query<{ value: unknown }>(
            name === 'lesson_library' ? 'select public.lesson_library() as value' : `select public.${name}($1) as value`,
            name === 'lesson_library' ? [] : [JSON.stringify(args.p)]));
          return rows.rows[0].value;
        } catch (error) { lessonDatabaseError(error as { code?: string }); throw error; }
      }),
      resources: resourceRepository(async (name, args) => {
        try {
          const values = name === 'resource_library' ? [args.p_resource_id] : [JSON.stringify(args.p)];
          if (!user) throw new AppError(401, 'Please sign in.');
          const rows = await database.asUser(user.subject, tx => tx.query<{ value: unknown }>(`select public.${name}($1) as value`, values));
          return rows.rows[0].value;
        } catch (error) { if (error instanceof AppError) throw error; resourceDatabaseError(error as { code?: string }); throw error; }
      }),
      originals: {
        async put(key, bytes) { await query('insert into storage.objects(bucket_id,name,fixture_bytes) values($1,$2,$3)', ['classthread-resources', key, bytes]); },
        async read(key) {
          const rows = await query<{ fixture_bytes: Uint8Array }>('select fixture_bytes from storage.objects where bucket_id=$1 and name=$2', ['classthread-resources',key]);
          if (!rows.length) throw new AppError(404, 'Original unavailable.');
          return rows[0].fixture_bytes;
        },
      },
      auth: {
        async currentUser() { return user; },
        async sendEmailCode() { /* Explicit local fixture: no external email. */ },
        async verifyEmailCode(email, code) {
          if (code !== '123456') throw new AppError(400, 'That code is invalid or expired. Request a new code.');
          user = { subject: await database.identity(email.toLowerCase()), email: email.toLowerCase() };
          token = randomUUID(); sessions.set(token, user);
          res.setHeader('Set-Cookie', stringifySetCookie({ name: 'classthread_fixture', value: token, httpOnly: true, sameSite: 'lax', path: '/' }));
        },
        async startGoogle() { throw new AppError(503, 'Google is not available in the development fixture.'); },
        async exchangeCode() { throw new AppError(400, 'External OAuth is not available in the development fixture.'); },
        async signOut() { if (token) sessions.delete(token); user = null; res.setHeader('Set-Cookie', stringifySetCookie({ name: 'classthread_fixture', value: '', maxAge: 0, httpOnly: true, sameSite: 'lax', path: '/' })); },
      },
    };
  };
}
