import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';
import type { LessonRepository } from '../../lessons/ports';
import type { LessonLibrary } from '../../../shared/contracts/lessons';
import { AppError } from '../../ports';

export type LessonRpc = 'lesson_library' | 'save_lesson' | 'schedule_lesson' | 'mark_lesson_taught' | 'reflect_on_lesson';
export type LessonTransport = (name: LessonRpc, args: Record<string, unknown>) => Promise<unknown>;
function camel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    ['sections', 'assignment_snapshot'].includes(key) ? item : camel(item)]));
}
export function lessonRepository(transport: LessonTransport): LessonRepository {
  return {
    async read() { return camel(await transport('lesson_library', {})) as LessonLibrary; },
    async save(id, value) { return await transport('save_lesson', { p: { ...value, id } }) as { lessonId: string; versionId: string }; },
    async schedule(value) { return await transport('schedule_lesson', { p: value }) as string; },
    async markTaught(occurrenceId, taughtOn) { return await transport('mark_lesson_taught', { p: { occurrenceId, taughtOn } }) as string; },
    async reflect(teachingRecordId, value) { return await transport('reflect_on_lesson', { p: { teachingRecordId, ...value } }) as string; },
  };
}
export function lessonDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === 'P0001') throw new AppError(409, 'A prior use was rated 1 or 2. Review Teaching Memory and acknowledge the warning before reuse.');
  if (error.code === '40001' || error.code === '23505') throw new AppError(409, 'This lesson, curriculum, or reflection changed in another tab, or this use was already saved. Reload before trying again.');
  if (error.code === '42501') throw new AppError(403, 'This lesson or teaching context is unavailable.');
  if (['23514', '23503', '23502', '22P02', '22007', '22008'].includes(error.code ?? '')) throw new AppError(400, 'Check lesson references and dates. Dates must fit the assignment; a taught date cannot be in the future.');
  throw new AppError(503, 'Lessons are unavailable. Check that the Increment 3 migration has been applied.');
}
export function supabaseLessonRepository(client: SupabaseClient<Database>): LessonRepository {
  return lessonRepository(async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    // Keep diagnostics useful without logging teacher text, identities, cookies or provider details.
    if (error) console.warn('ClassThread lesson RPC failed', { rpc: name, code: error.code ?? 'unknown' });
    lessonDatabaseError(error); return data;
  });
}
