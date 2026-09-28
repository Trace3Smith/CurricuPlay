import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '../server/providers/supabase/database';
import { lessonDatabaseError, supabaseLessonRepository } from '../server/providers/supabase/lessons';
import { lessonService } from '../server/lessons/service';
import type { LessonRepository } from '../server/lessons/ports';

test('Production lesson adapter uses authenticated narrow RPCs and preserves flexible section keys', async () => {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const id = randomUUID();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, headers: new Headers(init?.headers), body: JSON.parse(init?.body as string) });
    return Response.json(url.endsWith('lesson_library') ? { lessons: [], versions: [{ id, lesson_id: id, assignment_snapshot: { teachingRole: 'CTE' }, sections: [{ kind: 'role.cte.shop_safety', label: 'Safety', content: 'Teacher directions', audience: 'instruction' }], standard_references: ['teacher-entered'], curriculum_node_ids: [] }], resourceLinks: [], occurrences: [], teachingRecords: [], reflections: [] } : id);
  };
  const client = createClient<Database>('https://supabase.example.com', 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher, headers: { Authorization: 'Bearer test-user-session' } } });
  const repository = supabaseLessonRepository(client); const library = await repository.read();
  expect(library.versions[0].lessonId).toBe(id); expect(library.versions[0].sections[0].kind).toBe('role.cte.shop_safety'); expect(library.versions[0].assignmentSnapshot.teachingRole).toBe('CTE');
  await repository.schedule({ id, versionId: id, assignmentId: id, scheduledOn: '2026-09-27', acknowledgeLowRating: true });
  await repository.markTaught(id, '2026-09-27');
  await repository.reflect(id, { revision: null, rating: 4, worked: 'Teacher notes', change: '', reflection: '', pacing: '', materials: '', transitions: '' });
  expect(calls.map(c => c.url.split('/').at(-1))).toEqual(['lesson_library', 'schedule_lesson', 'mark_lesson_taught', 'reflect_on_lesson']);
  expect(calls.every(c => c.headers.get('authorization') === 'Bearer test-user-session')).toBe(true);
  expect(calls[1].body).toEqual({ p: { id, versionId: id, assignmentId: id, scheduledOn: '2026-09-27', acknowledgeLowRating: true } });
});

test('Lesson validation and provider failures fail closed without leaking provider details', async () => {
  let writes = 0;
  const service = lessonService({ save: async () => { writes++; return { lessonId: '', versionId: '' }; } } as unknown as LessonRepository);
  const value = { title: 'Manual', assignmentId: randomUUID(), readiness: 'draft', sections: [], standardReferences: [], curriculumMode: 'active', curriculumVersionId: null, curriculumBindingId: null, curriculumNodeIds: [], resourceVersionIds: [], sourceVersionId: null, revision: null, acknowledgeLowRating: false };
  await expect(service.save(null, { ...value, workspaceId: randomUUID() })).rejects.toThrow();
  await expect(service.save(randomUUID(), value)).rejects.toThrow('requires');
  await expect(service.save(null, { ...value, resourceVersionIds: ['not-a-uuid'] })).rejects.toThrow();
  expect(writes).toBe(0);
  for (const [code, status] of [['P0001', 409], ['40001', 409], ['23505', 409], ['42501', 403], ['23514', 400], ['PGRST202', 503]] as const) {
    try { lessonDatabaseError({ code, message: 'Sensitive provider diagnostic' }); throw new Error('Expected failure'); }
    catch (e) { expect(e).toMatchObject({ status }); expect((e as Error).message).not.toContain('Sensitive'); }
  }
});

test('A rejected authenticated reflection RPC logs only its operation and code and returns a safe error', async () => {
  const warnings: unknown[][] = []; const warn = console.warn;
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  const client = createClient<Database>('https://supabase.example.com', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer private-session' }, fetch: async (input, init) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(init?.body as string) });
      return Response.json({ code: '42501', message: 'Sensitive diagnostic with teacher content', details: 'Private provider details' }, { status: 403 });
    } },
  });
  const recordId = randomUUID();
  const reflection = { revision: null, rating: 4, worked: 'Private teacher reflection', change: '', reflection: '', pacing: '', materials: '', transitions: '' };
  console.warn = (...args) => { warnings.push(args); };
  try { await expect(lessonService(supabaseLessonRepository(client)).reflect(recordId, reflection)).rejects.toMatchObject({ status: 403, message: 'This lesson or teaching context is unavailable.' }); }
  finally { console.warn = warn; }
  expect(calls).toHaveLength(1); expect(calls[0].url).toContain('/rest/v1/rpc/reflect_on_lesson');
  expect(calls[0].headers.get('authorization')).toBe('Bearer private-session');
  expect(calls[0].body).toEqual({ p: { teachingRecordId: recordId, ...reflection } });
  expect(warnings).toEqual([['ClassThread lesson RPC failed', { rpc: 'reflect_on_lesson', code: '42501' }]]);
});
