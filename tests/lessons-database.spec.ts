import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fixtureDatabase, type FixtureDatabase } from './fixtures/database';
import { lessonRepository } from '../server/providers/supabase/lessons';
import { hasLowRating, lessonSaveInput, teacherDate, teachingMemory, type LessonLibrary, type LessonSaveInput } from '../shared/contracts/lessons';

// Match the bootstrapped teacher's timezone, including the hours after UTC midnight.
const today = teacherDate('America/New_York');
const base = { title: 'Teacher-authored lesson', readiness: 'draft', sections: [], standardReferences: [], curriculumMode: 'active', curriculumVersionId: null, curriculumBindingId: null, curriculumNodeIds: [], resourceVersionIds: [], sourceVersionId: null, revision: null, acknowledgeLowRating: false } as const;
const reflection = { revision: null, rating: 2, worked: 'Visual directions', change: 'Allow more practice', reflection: 'Teacher-authored memory', pacing: 'More time', materials: 'Two sets', transitions: 'Model the change' };

test.describe('Lessons PostgreSQL invariants and RLS', () => {
  test.describe.configure({ mode: 'serial' });
  let database: FixtureDatabase, alice: string, bob: string, workspace: string, assignment: string, otherAssignment: string;
  async function rpc<T = string>(user: string, name: string, p: unknown): Promise<T> {
    return (await database.asUser(user, tx => tx.query<{ value: T }>(`select public.${name}($1) as value`, [JSON.stringify(p)]))).rows[0].value;
  }
  async function library(user = alice): Promise<LessonLibrary> {
    return lessonRepository(async () => (await database.asUser(user, tx => tx.query<{ value: unknown }>('select public.lesson_library() as value'))).rows[0].value).read();
  }
  async function save(extra: Record<string, unknown> = {}) {
    return rpc<{ lessonId: string; versionId: string }>(alice, 'save_lesson', { ...base, assignmentId: assignment, ...extra });
  }
  async function schedule(versionId: string, extra: Record<string, unknown> = {}) {
    return rpc(alice, 'schedule_lesson', { id: randomUUID(), versionId, assignmentId: assignment, scheduledOn: today, acknowledgeLowRating: false, ...extra });
  }
  async function taught(versionId: string) {
    const occurrence = await schedule(versionId);
    const record = await rpc(alice, 'mark_lesson_taught', { occurrenceId: occurrence, taughtOn: today });
    return { occurrence, record };
  }
  async function resource() {
    const id = randomUUID();
    const metadata = { title: 'Private original', type: 'pacing_guide', origin: 'teacher', assignmentIds: [], schoolYearId: null };
    const resourceId = await rpc(alice, 'save_resource', { metadata, version: { id, kind: 'file', fileName: 'guide.csv', mediaType: 'text/csv', byteSize: 20, sha256: '0'.repeat(64), storageKey: `${workspace}/${id}/original`, externalUrl: null } });
    return { id, resourceId, metadata };
  }
  async function curriculum(versionId: string, from = '2020-01-01', previousBinding: string | null = null) {
    const cv = await rpc(alice, 'propose_curriculum', { resourceVersionId: versionId, label: 'Manual reviewed curriculum', effectiveFrom: from, effectiveTo: '2040-12-31', supersedesId: null, purposes: ['instructional_detail'], mapping: {}, proposal: { adapter: 'tabular-v1', nodes: [{ id: 'row-2', row: 2, assertions: [{ id: '2-A', field: 'topic', text: 'Explore patterns', citation: { sheet: 'CSV', row: 2, cell: 'A2', quote: 'Explore patterns' }, provenance: 'extracted', confidence: 'literal', uncertainty: [] }, { id: '2-B', field: 'standards', text: 'Excluded', citation: { sheet: 'CSV', row: 2, cell: 'B2', quote: 'Excluded' }, provenance: 'extracted', confidence: 'literal', uncertainty: [] }] }, { id: 'row-3', row: 3, assertions: [{ id: '3-A', field: 'topic', text: 'Excluded node', citation: { sheet: 'CSV', row: 3, cell: 'A3', quote: 'Excluded node' }, provenance: 'extracted', confidence: 'literal', uncertainty: [] }] }], missing: [], conflicts: [], warnings: [] } });
    await rpc(alice, 'review_curriculum', { id: cv, revision: 1, approve: true, decisions: { '2-A': 'accept', '2-B': 'exclude', '3-A': 'exclude' }, note: '', acknowledgeLimitations: true });
    const binding = await rpc(alice, 'activate_curriculum', { id: cv, assignmentId: assignment, expectedBindingId: previousBinding });
    return { cv, binding };
  }
  test.beforeAll(async () => { database = await fixtureDatabase(); });
  test.beforeEach(async () => {
    alice = await database.identity(`${randomUUID()}@example.test`); bob = await database.identity(`${randomUUID()}@example.test`);
    for (const user of [alice, bob]) await database.asUser(user, tx => tx.exec('select public.bootstrap_teacher()'));
    workspace = (await database.asUser(alice, tx => tx.query<{ id: string }>('select id from public.workspaces'))).rows[0].id;
    assignment = randomUUID(); otherAssignment = randomUUID(); const year = randomUUID();
    await database.asUser(alice, async tx => {
      await tx.query("insert into public.school_years(id,workspace_id,name,starts_on,ends_on) values($1,$2,'Test span','2020-01-01','2040-12-31')", [year, workspace]);
      for (const [id, title] of [[assignment, 'Art'], [otherAssignment, 'Intervention']]) await tx.query("insert into public.teaching_assignments(id,workspace_id,school_year_id,title,jurisdiction,subject,grades,teaching_role,starts_on,ends_on) values($1,$2,$3,$4,'Any jurisdiction',$4,array['mixed'],'Teacher','2020-01-01','2040-12-31')", [id, workspace, year, title]);
    });
  });
  test.afterAll(async () => { await database?.db.close(); });

  test('Ownership isolation covers all six tables, RPC reads, forged references and anonymous access', async () => {
    const r = await resource(); const l = await save({ resourceVersionIds: [r.id] }); const t = await taught(l.versionId);
    await rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection });
    await database.asUser(bob, async tx => {
      for (const table of ['lessons', 'lesson_versions', 'lesson_resource_links', 'lesson_occurrences', 'teaching_records', 'lesson_reflections']) expect((await tx.query(`select * from public.${table}`)).rows).toEqual([]);
    });
    expect(Object.values(await library(bob)).every(rows => rows.length === 0)).toBe(true);
    for (const [name, input] of [
      ['save_lesson', { ...base, assignmentId: assignment, id: l.lessonId, revision: 1, sourceVersionId: l.versionId }],
      ['schedule_lesson', { id: randomUUID(), versionId: l.versionId, assignmentId: assignment, scheduledOn: today }],
      ['mark_lesson_taught', { occurrenceId: t.occurrence, taughtOn: today }],
      ['reflect_on_lesson', { ...reflection, teachingRecordId: t.record }],
    ] as const) await expect(rpc(bob, name, input)).rejects.toMatchObject({ code: '42501' });
    await expect(database.db.transaction(async tx => { await tx.exec('set local role anon'); await tx.exec('select public.lesson_library()'); })).rejects.toMatchObject({ code: '42501' });
    await expect(database.db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select public.save_lesson($1)', [JSON.stringify(base)]); })).rejects.toMatchObject({ code: '42501' });
  });

  test('Every save appends an immutable version and concurrent revisions cannot overwrite history', async () => {
    const first = await save(); const before = (await library()).versions[0];
    const next = await save({ id: first.lessonId, revision: 1, sourceVersionId: first.versionId, title: 'Revised', sections: [{ kind: 'safety', label: 'Safety', content: 'Teacher directions', audience: 'instruction' }] });
    expect(next.lessonId).toBe(first.lessonId); expect(next.versionId).not.toBe(first.versionId);
    const data = await library(); expect(data.versions).toHaveLength(2); expect(data.lessons[0].revision).toBe(2); expect(data.versions.find(v => v.id === first.versionId)).toEqual(before);
    await expect(save({ id: first.lessonId, revision: 1, sourceVersionId: first.versionId })).rejects.toMatchObject({ code: '40001' });
    await expect(database.db.query("update public.lesson_versions set title='Rewrite' where id=$1", [first.versionId])).rejects.toThrow('immutable');
    await expect(database.db.query('delete from public.lesson_versions where id=$1', [first.versionId])).rejects.toThrow('immutable');
    await expect(database.asUser(alice, tx => tx.query("update public.lesson_versions set title='Rewrite' where id=$1", [first.versionId]))).rejects.toMatchObject({ code: '42501' });
  });

  test('Exact active curriculum survives replacement, stale saves fail, and retaining old curriculum is explicit', async () => {
    const r = await resource(); const first = await curriculum(r.id);
    const original = await save({ curriculumVersionId: first.cv, curriculumBindingId: first.binding, curriculumNodeIds: ['row-2'] });
    const before = (await library()).versions[0];
    const next = await curriculum(r.id, today, first.binding);
    await expect(save({ curriculumVersionId: first.cv, curriculumBindingId: first.binding })).rejects.toMatchObject({ code: '40001' });
    const retained = await save({ sourceVersionId: original.versionId, curriculumMode: 'retain', curriculumVersionId: first.cv, curriculumBindingId: first.binding, curriculumNodeIds: ['row-2'] });
    const newer = await save({ curriculumVersionId: next.cv, curriculumBindingId: next.binding });
    const data = await library(); expect(data.versions.find(v => v.id === original.versionId)).toEqual(before);
    expect(data.versions.find(v => v.id === retained.versionId)?.curriculumVersionId).toBe(first.cv);
    expect(data.versions.find(v => v.id === newer.versionId)?.curriculumVersionId).toBe(next.cv);
    await expect(save({ curriculumMode: 'retain', curriculumVersionId: first.cv, curriculumBindingId: first.binding })).rejects.toMatchObject({ code: '23514' });
    await expect(save({ sourceVersionId: original.versionId, curriculumMode: 'retain', assignmentId: otherAssignment, curriculumVersionId: first.cv, curriculumBindingId: first.binding })).rejects.toMatchObject({ code: '23514' });
  });

  test('Only reviewed retained nodes from the exact curriculum can be referenced', async () => {
    const r = await resource(); const cv = await curriculum(r.id);
    for (const nodes of [['invented'], ['row-3'], ['row-2', 'row-2']]) await expect(save({ curriculumVersionId: cv.cv, curriculumBindingId: cv.binding, curriculumNodeIds: nodes })).rejects.toMatchObject({ code: '23514' });
    await expect(save({ curriculumVersionId: cv.cv, curriculumBindingId: randomUUID() })).rejects.toMatchObject({ code: '40001' });
    expect((await library()).lessons).toEqual([]);
  });

  test('Attachments pin exact resource originals and invalid cross-workspace links roll back the entire save', async () => {
    const r = await resource(); const first = await save({ resourceVersionIds: [r.id] });
    const nextId = randomUUID();
    await rpc(alice, 'save_resource', { id: r.resourceId, revision: 1, metadata: { ...r.metadata, title: 'New resource title' }, version: { id: nextId, kind: 'file', fileName: 'new.csv', mediaType: 'text/csv', byteSize: 20, sha256: '1'.repeat(64), storageKey: `${workspace}/${nextId}/original`, externalUrl: null } });
    expect((await library()).resourceLinks).toEqual([expect.objectContaining({ lessonVersionId: first.versionId, resourceVersionId: r.id })]);
    const b = (await database.asUser(bob, tx => tx.query<{ id: string }>('select id from public.workspaces'))).rows[0].id;
    const bid = randomUUID();
    const br = await rpc(bob, 'save_resource', { metadata: r.metadata, version: { id: bid, kind: 'file', fileName: 'private.csv', mediaType: 'text/csv', byteSize: 20, sha256: '2'.repeat(64), storageKey: `${b}/${bid}/original`, externalUrl: null } }); expect(br).toBeTruthy();
    await expect(save({ resourceVersionIds: [bid] })).rejects.toMatchObject({ code: '23503' });
    expect((await library()).lessons).toHaveLength(1);
    await expect(database.db.query('delete from public.lesson_resource_links where lesson_version_id=$1', [first.versionId])).rejects.toThrow('immutable');
  });

  test('Scheduling pins a version and explicit assignment without creating a taught record', async () => {
    const first = await save(); const occurrence = await schedule(first.versionId, { assignmentId: otherAssignment });
    const data = await library(); expect(data.teachingRecords).toEqual([]); expect(data.reflections).toEqual([]);
    expect(data.occurrences[0]).toMatchObject({ id: occurrence, lessonVersionId: first.versionId, assignmentId: otherAssignment, scheduledOn: today, assignmentSnapshot: { title: 'Intervention' } });
    expect(data.versions[0].assignmentSnapshot.title).toBe('Art');
    for (const scheduledOn of ['2019-12-31', '2041-01-01']) await expect(schedule(first.versionId, { scheduledOn })).rejects.toMatchObject({ code: '23514' });
    await expect(schedule(first.versionId, { id: occurrence })).rejects.toMatchObject({ code: '23505' });
    await expect(database.db.query('update public.lesson_occurrences set assignment_id=$1 where id=$2', [assignment, occurrence])).rejects.toThrow('immutable');
  });

  test('Mark taught is explicit, date-checked and creates exactly one immutable teaching record', async () => {
    const first = await save(); const occurrence = await schedule(first.versionId);
    await expect(rpc(alice, 'mark_lesson_taught', { occurrenceId: occurrence, taughtOn: '2040-01-01' })).rejects.toMatchObject({ code: '23514' });
    const record = await rpc(alice, 'mark_lesson_taught', { occurrenceId: occurrence, taughtOn: today });
    await expect(rpc(alice, 'mark_lesson_taught', { occurrenceId: occurrence, taughtOn: today })).rejects.toMatchObject({ code: '23505' });
    expect((await library()).teachingRecords).toHaveLength(1);
    await expect(database.db.query('delete from public.teaching_records where id=$1', [record])).rejects.toThrow('immutable');
  });

  test('Reflection ratings persist on a taught record and edits require its revision', async () => {
    const first = await save(); const t = await taught(first.versionId);
    await expect(rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.occurrence, ...reflection })).rejects.toMatchObject({ code: '42501' });
    for (const rating of [0, 6]) await expect(rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection, rating })).rejects.toMatchObject({ code: '23514' });
    const id = await rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection });
    expect((await library()).reflections[0]).toMatchObject({ ...reflection, id, teachingRecordId: t.record, revision: 1 });
    await rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection, revision: 1, reflection: 'Added detail' });
    await expect(rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection, revision: 1 })).rejects.toMatchObject({ code: '40001' });
    expect((await library()).reflections[0]).toMatchObject({ revision: 2, reflection: 'Added detail' });
    await expect(database.db.query('update public.lesson_reflections set teaching_record_id=$1 where id=$2', [randomUUID(), id])).rejects.toThrow('immutable');
  });

  test('Low-rating reuse gates the taught lesson scheduling and revisions, while copies preserve only lineage', async () => {
    const first = await save(); const t = await taught(first.versionId);
    await rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection });
    const before = await library(); expect(hasLowRating(before, first.lessonId)).toBe(true);
    await expect(schedule(first.versionId)).rejects.toMatchObject({ code: 'P0001' });
    await expect(save({ id: first.lessonId, revision: 1, sourceVersionId: first.versionId })).rejects.toMatchObject({ code: 'P0001' });
    const copy = await save({ sourceVersionId: first.versionId });
    const revision = await save({ id: first.lessonId, revision: 1, sourceVersionId: first.versionId, acknowledgeLowRating: true });
    await schedule(revision.versionId, { acknowledgeLowRating: true });
    await schedule(copy.versionId);
    const data = await library(); expect(data.teachingRecords).toEqual(before.teachingRecords); expect(data.reflections).toEqual(before.reflections);
    expect(teachingMemory(data, copy.lessonId)).toEqual([]);
    expect(hasLowRating(data, copy.lessonId)).toBe(false);
    expect(data.lessons.find(l => l.id === copy.lessonId)?.copiedFromVersionId).toBe(first.versionId);
    expect(data.versions.find(v => v.id === first.versionId)).toEqual(before.versions[0]);
  });

  test('Reusable copy B keeps lineage but never inherits lesson A teaching memory or low-rating gating', async () => {
    const a = await save({ title: 'Lesson A' }); const use = await taught(a.versionId);
    await rpc(alice, 'reflect_on_lesson', { teachingRecordId: use.record, ...reflection });
    await save({ id: a.lessonId, revision: 1, sourceVersionId: a.versionId, title: 'Lesson A revised', acknowledgeLowRating: true });
    const before = await library();
    // Bypass the old copy-creation gate to independently reproduce the inherited scheduling gate.
    const b = await save({ title: 'Lesson B', sourceVersionId: a.versionId, acknowledgeLowRating: true });
    const copied = await library();
    expect(copied.lessons.find(l => l.id === b.lessonId)?.copiedFromVersionId).toBe(a.versionId);
    expect(copied.versions.filter(v => v.lessonId === b.lessonId)).toEqual([expect.objectContaining({ id: b.versionId, number: 1, readiness: 'draft' })]);
    expect(copied.occurrences.filter(o => o.lessonVersionId === b.versionId)).toEqual([]);
    expect(copied.teachingRecords).toEqual(before.teachingRecords); expect(copied.reflections).toEqual(before.reflections);
    expect(copied.versions.filter(v => v.lessonId === a.lessonId)).toEqual(before.versions);
    expect.soft(teachingMemory(copied, b.lessonId)).toEqual([]);
    expect.soft(hasLowRating(copied, b.lessonId)).toBe(false);
    expect(hasLowRating(copied, a.lessonId)).toBe(true);
    await schedule(b.versionId); // SQL must also allow B without acknowledgement.
    await expect(schedule(a.versionId)).rejects.toMatchObject({ code: 'P0001' });
    const after = await library();
    expect(after.teachingRecords).toEqual(before.teachingRecords); expect(after.reflections).toEqual(before.reflections);
    expect(after.versions.filter(v => v.lessonId === a.lessonId)).toEqual(before.versions);
    expect(after.occurrences.filter(o => o.lessonVersionId === a.versionId)).toEqual(before.occurrences);
    // Once B itself is taught and rated poorly, only B gains that new memory and gate.
    const bOccurrence = after.occurrences.find(o => o.lessonVersionId === b.versionId)!;
    const bRecord = await rpc(alice, 'mark_lesson_taught', { occurrenceId: bOccurrence.id, taughtOn: today });
    await rpc(alice, 'reflect_on_lesson', { teachingRecordId: bRecord, ...reflection, rating: 1, worked: 'B own feedback' });
    const rated = await library();
    expect(teachingMemory(rated, b.lessonId)).toHaveLength(1);
    expect(teachingMemory(rated, b.lessonId)[0].reflection?.worked).toBe('B own feedback');
    expect(teachingMemory(rated, a.lessonId)).toEqual(teachingMemory(before, a.lessonId));
    await expect(schedule(b.versionId)).rejects.toMatchObject({ code: 'P0001' });
    const c = await save({ sourceVersionId: b.versionId });
    expect(teachingMemory(await library(), c.lessonId)).toEqual([]);
    await schedule(c.versionId);
  });

  test('Forward migration separates existing copies without changing rows, lineage, ownership or grants', async () => {
    const original = await readFile(new URL('../supabase/migrations/202609270002_lessons_memory.sql', import.meta.url), 'utf8');
    const correction = await readFile(new URL('../supabase/migrations/202609270003_lesson_memory_identity.sql', import.meta.url), 'utf8');
    // Reproduce the already-applied function definitions only in this isolated test database.
    for (const name of ['private.lesson_low_rating', 'public.save_lesson']) {
      const start = original.indexOf(`create function ${name}(`);
      const end = original.indexOf('$$;', start) + 3;
      await database.db.exec(original.slice(start, end).replace('create function', 'create or replace function'));
    }
    try {
      const a = await save(); const t = await taught(a.versionId);
      await rpc(alice, 'reflect_on_lesson', { teachingRecordId: t.record, ...reflection });
      await save({ id: a.lessonId, revision: 1, sourceVersionId: a.versionId, acknowledgeLowRating: true });
      const b = await save({ sourceVersionId: a.versionId, acknowledgeLowRating: true });
      const before = await library();
      await expect(schedule(b.versionId)).rejects.toMatchObject({ code: 'P0001' });
      const permissions = () => database.db.query("select proname, proowner, proacl::text from pg_proc where oid in ('private.lesson_low_rating(uuid,uuid)'::regprocedure, 'public.save_lesson(jsonb)'::regprocedure) order by proname");
      const previousPermissions = await permissions();
      await database.db.exec(correction);
      expect(await library()).toEqual(before);
      expect((await permissions()).rows).toEqual(previousPermissions.rows);
      await schedule(b.versionId);
      await save({ sourceVersionId: b.versionId });
      await expect(schedule(a.versionId)).rejects.toMatchObject({ code: 'P0001' });
      expect(Object.values(await library(bob)).every(rows => rows.length === 0)).toBe(true);
    } finally { await database.db.exec(correction); }
  });

  test('Assignment switching and new revisions never relabel original or taught context', async () => {
    const first = await save(); const t = await taught(first.versionId); const before = await library();
    const year = (await database.asUser(alice, tx => tx.query<{ id: string }>('select id from public.school_years'))).rows[0].id;
    await database.asUser(alice, tx => tx.query('update public.teacher_profiles set selected_school_year_id=$1,selected_assignment_id=$2', [year, otherAssignment]));
    await save({ id: first.lessonId, revision: 1, sourceVersionId: first.versionId, assignmentId: otherAssignment });
    const after = await library(); expect(after.lessons[0].originalAssignmentId).toBe(assignment);
    expect(after.versions.find(v => v.id === first.versionId)).toEqual(before.versions[0]); expect(after.occurrences).toEqual(before.occurrences); expect(after.teachingRecords[0].id).toBe(t.record);
    expect(after.versions[0].assignmentId).toBe(otherAssignment);
    await expect(database.db.query('update public.lessons set original_assignment_id=$1 where id=$2', [otherAssignment, first.lessonId])).rejects.toThrow('immutable');
  });

  test('Optional role sections remain universal; malformed sections and private-note disclosure are rejected', async () => {
    for (const role of ['elementary', 'pe', 'art', 'music', 'lab', 'special_education', 'secondary', 'intervention', 'cte']) {
      const value = { ...base, assignmentId: assignment, sections: [{ kind: `role.${role}.directions`, label: 'Directions', content: 'Teacher-written', audience: 'instruction' }] };
      expect(lessonSaveInput.safeParse(value).success).toBe(true); await save(value);
    }
    for (const section of [{ kind: 'private_notes', label: 'Private', content: 'Personal', audience: 'instruction' }, { kind: 'safety', label: 'Safety', content: '', audience: 'instruction' }]) {
      await expect(save({ sections: [section] })).rejects.toMatchObject({ code: '23514' });
      expect(lessonSaveInput.safeParse({ ...base, assignmentId: assignment, sections: [section] }).success).toBe(false);
    }
    const data = await library(); expect(data.versions.every(v => v.standardReferences.length === 0 && v.sections.length === 1)).toBe(true);
    expect(lessonSaveInput.safeParse({ ...base, assignmentId: assignment, workspaceId: randomUUID() }).success).toBe(false);
  });
});
