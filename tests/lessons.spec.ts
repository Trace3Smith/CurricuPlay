import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FoundationData } from '../shared/contracts/foundation';
import type { ResourceLibrary } from '../shared/contracts/resources';
import { teacherDate, type LessonLibrary } from '../shared/contracts/lessons';

const origin = 'http://127.0.0.1:5174'; const headers = { Origin: origin };
// Match the bootstrapped teacher's timezone, including the hours after UTC midnight.
const today = teacherDate('America/New_York');
const legacy = JSON.parse(readFileSync('tests/fixtures/legacy-browser-state.v1.json', 'utf8')) as { records: Record<string, string> };
test.use({ baseURL: origin });
async function get<T>(request: APIRequestContext, path: string): Promise<T> { const r = await request.get(`${origin}/api${path}`); expect(r.ok(), await r.text()).toBe(true); return r.json(); }
async function post<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> { const r = await request.post(`${origin}/api${path}`, { headers, data }); expect(r.ok(), await r.text()).toBe(true); return r.json(); }
async function login(page: Page) {
  await page.goto('/sign-in'); await post(page.request, '/auth/verify', { email: `${randomUUID()}@example.test`, token: '123456' });
  await post(page.request, '/school-years', { name: 'Lesson test year', startsOn: '2020-01-01', endsOn: '2040-12-31' });
  let f = await get<FoundationData>(page.request, '/foundation');
  for (const title of ['Studio', 'Intervention']) await post(page.request, '/assignments', { schoolYearId: f.schoolYears[0].id, title, jurisdiction: 'Any jurisdiction', district: '', school: '', subject: title, course: '', grades: ['mixed'], teachingRole: 'Teacher', schedule: '', startsOn: '2020-01-01', endsOn: '2040-12-31', isActive: true });
  f = await get<FoundationData>(page.request, '/foundation');
  await page.request.patch(`${origin}/api/context`, { headers, data: { schoolYearId: f.schoolYears[0].id, assignmentId: f.assignments[0].id, revision: f.profile.revision } });
  return f;
}
async function seedCurriculum(page: Page, assignmentId: string) {
  const resource = await post<{ id: string }>(page.request, '/resources', { metadata: { title: 'Pattern source', description: 'Synthetic test fixture', type: 'pacing_guide', origin: 'teacher', sourceName: 'Test teacher', subject: 'Art', course: '', grades: ['mixed'], standards: [], tags: [], schoolYearId: null, assignmentIds: [assignmentId] }, original: { kind: 'file', fileName: 'patterns.csv', base64: Buffer.from('Topic,Notes\nPatterns,Use paper shapes\n').toString('base64') } });
  const data = await get<ResourceLibrary>(page.request, `/resources/${resource.id}`);
  const cv = await post<{ id: string }>(page.request, `/resources/${resource.id}/curriculum`, { resourceVersionId: data.versions[0].id, label: 'Reviewed patterns', effectiveFrom: '2020-01-01', effectiveTo: '2040-12-31', purposes: ['instructional_detail'], mapping: { sheet: 'CSV', firstRow: 2, lastRow: 2, columns: [{ field: 'topic', column: 'A' }, { field: 'notes', column: 'B' }] }, supersedesId: null });
  await post(page.request, `/resources/${resource.id}/curriculum/${cv.id}/review`, { revision: 1, approve: true, decisions: { '2-A': 'accept', '2-B': 'accept' }, note: '', acknowledgeLimitations: true });
  const binding = await post<{ id: string }>(page.request, `/resources/${resource.id}/curriculum/${cv.id}/activate`, { assignmentId, expectedBindingId: null });
  return { resource, cv, binding, original: data.versions[0] };
}
function input(assignmentId: string) { return { title: 'Manual plan', assignmentId, readiness: 'draft', sections: [], standardReferences: [], curriculumMode: 'active', curriculumVersionId: null, curriculumBindingId: null, curriculumNodeIds: [], resourceVersionIds: [], sourceVersionId: null, revision: null, acknowledgeLowRating: false }; }

// This is also the requested complete manual-review flow, backed by PostgreSQL and HTTP.
test('1920×1080: create, attach, save, schedule, classroom, teach, reflect, revisit, revise and copy preserve history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = await login(page);
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, legacy.records);
  const source = await seedCurriculum(page, f.assignments[0].id);
  await page.goto('/classroom'); await expect(page.getByText('No upcoming lesson scheduled for this assignment.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.getByRole('link', { name: 'Create a lesson', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Pattern workshop');
  await expect(page.getByRole('heading', { name: 'Reviewed patterns', exact: true })).toBeVisible();
  await page.getByText('Choose curriculum topics / source rows (optional)', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Source row 2', exact: true }).check();
  await page.getByRole('combobox', { name: 'Pattern source', exact: true }).selectOption(source.original.id);
  await page.getByRole('textbox', { name: 'Learning target / objective', exact: true }).fill('Describe a repeating pattern.');
  await page.locator('summary').filter({ hasText: /^Instruction/ }).click();
  await page.getByRole('textbox', { name: 'Student practice', exact: true }).fill('Arrange paper shapes and explain the pattern.');
  await page.locator('summary').filter({ hasText: /^Teacher-only notes/ }).click();
  await page.getByRole('textbox', { name: 'Private notes', exact: true }).fill('Prepare a second set of materials.');
  await page.getByRole('combobox', { name: 'Lesson readiness', exact: true }).selectOption('ready');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/lessons-editor-1920.png' });
  await page.screenshot({ path: 'test-results/lessons-editor-full.png', fullPage: true });
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pattern workshop', exact: true })).toBeVisible();
  const first = await get<LessonLibrary>(page.request, '/lessons'); const lesson = first.lessons[0]; const version = first.versions[0];
  expect(version.curriculumVersionId).toBe(source.cv.id); expect(version.curriculumBindingId).toBe(source.binding.id); expect(version.curriculumNodeIds).toHaveLength(1);
  expect(first.resourceLinks[0].resourceVersionId).toBe(source.original.id); expect(version.sections.find(s => s.kind === 'private_notes')?.audience).toBe('teacher');
  await page.getByLabel('Scheduled date', { exact: true }).fill(today);
  await page.getByRole('button', { name: 'Schedule lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Planned · ${today} · Version 1`, exact: true })).toBeVisible();
  expect((await get<LessonLibrary>(page.request, '/lessons')).teachingRecords).toEqual([]);
  await page.getByRole('link', { name: 'My Classroom', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Pattern workshop', exact: true })).toBeVisible();
  await expect(page.getByText(`${today} · Planned · Version 1 · Ready — reviewed by you`, { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/lessons-classroom-1920.png' });
  await page.screenshot({ path: 'test-results/lessons-classroom-full.png', fullPage: true });
  await page.getByLabel('Active Teaching Assignment', { exact: true }).selectOption(f.assignments[1].id);
  await expect(page.getByText('No upcoming lesson scheduled for this assignment.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pattern workshop', exact: true })).toHaveCount(0);
  await page.getByLabel('Active Teaching Assignment', { exact: true }).selectOption(f.assignments[0].id);
  await page.getByRole('link', { name: 'Open / mark taught →', exact: true }).click();
  await page.getByRole('button', { name: 'Mark taught', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Taught · ${today} · Version 1`, exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Rating', exact: true }).selectOption('2');
  await page.getByRole('textbox', { name: 'What worked', exact: true }).fill('Students explained their choices.');
  await page.getByRole('textbox', { name: 'What should change', exact: true }).fill('Allow more practice time.');
  await page.getByRole('textbox', { name: 'Pacing notes', exact: true }).fill('Opening took too long.');
  await page.getByRole('button', { name: 'Save reflection', exact: true }).click();
  await expect(page.getByText('A prior use was rated 1 or 2 out of 5. Review these notes before reuse.', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Teaching Memory', exact: true })).toBeVisible();
  await expect(page.getByText('Allow more practice time.', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Schedule lesson', exact: true })).toBeDisabled();
  const beforeReuse = await get<LessonLibrary>(page.request, '/lessons');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/lessons-memory-1920.png' });
  await page.screenshot({ path: 'test-results/lessons-memory-full.png', fullPage: true });
  await page.getByRole('link', { name: 'Revise lesson', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Pattern workshop revised');
  await expect(page.getByRole('button', { name: 'Save lesson version', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I reviewed the prior teaching notes', exact: false }).check();
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pattern workshop revised', exact: true })).toBeVisible();
  const revised = await get<LessonLibrary>(page.request, '/lessons');
  expect(revised.lessons).toHaveLength(1); expect(revised.versions).toHaveLength(2); expect(revised.reflections).toEqual(beforeReuse.reflections); expect(revised.teachingRecords).toEqual(beforeReuse.teachingRecords);
  await page.getByRole('link', { name: 'Make a reusable copy', exact: true }).click();
  await page.getByRole('combobox', { name: 'Lesson Teaching Assignment', exact: true }).selectOption(f.assignments[1].id);
  await expect(page.getByRole('checkbox', { name: 'I reviewed the prior teaching notes', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pattern workshop revised (copy)', exact: true })).toBeVisible();
  await expect(page.getByText('No taught history yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule lesson', exact: true })).toBeEnabled();
  const copied = await get<LessonLibrary>(page.request, '/lessons'); expect(copied.lessons).toHaveLength(2); expect(copied.reflections).toEqual(beforeReuse.reflections); expect(copied.occurrences).toEqual(beforeReuse.occurrences);
  await page.goto(`/plan/${lesson.id}?version=${version.id}`);
  await expect(page.getByRole('heading', { name: 'Pattern workshop', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(legacy.records))).toEqual(legacy.records);
  expect(errors).toEqual([]);
});

test('1920×1080: reusable copy B starts without lesson A low-rating warning or Teaching Memory', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = await login(page);
  const a = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', { ...input(f.assignments[0].id), title: 'Lesson A', readiness: 'ready' });
  const o = await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: a.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false });
  const t = await post<{ id: string }>(page.request, `/lessons/${o.id}/taught`, { taughtOn: today });
  await post(page.request, `/lessons/${t.id}/reflection`, { revision: null, rating: 2, worked: 'A original feedback', change: 'A needs more practice', reflection: '', pacing: '', materials: '', transitions: '' });
  await post(page.request, `/lessons/${a.lessonId}/versions`, { ...input(f.assignments[0].id), title: 'Lesson A revised', revision: 1, sourceVersionId: a.versionId, acknowledgeLowRating: true });
  const before = await get<LessonLibrary>(page.request, '/lessons');
  await page.goto(`/plan/${a.lessonId}?version=${a.versionId}`);
  await page.getByRole('link', { name: 'Make a reusable copy', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Lesson B');
  await expect(page.getByRole('heading', { name: 'Teaching Memory', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save lesson version', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'I reviewed the prior teaching notes', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lesson B', exact: true })).toBeVisible();
  await page.reload();
  const copied = await get<LessonLibrary>(page.request, '/lessons');
  const b = copied.lessons.find(l => l.id !== a.lessonId)!;
  const bv = copied.versions.find(v => v.lessonId === b.id)!;
  expect(b.copiedFromVersionId).toBe(a.versionId);
  expect(bv).toMatchObject({ number: 1, readiness: 'draft', sourceVersionId: a.versionId });
  expect(copied.occurrences).toEqual(before.occurrences); expect(copied.teachingRecords).toEqual(before.teachingRecords); expect(copied.reflections).toEqual(before.reflections);
  expect(copied.versions.filter(v => v.lessonId === a.lessonId)).toEqual(before.versions);
  await expect(page.getByText('No uses scheduled yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('No taught history yet.', { exact: false })).toBeVisible();
  await expect(page.getByText('A prior use was rated', { exact: false })).toHaveCount(0);
  await expect(page.getByText('A original feedback', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Schedule lesson', exact: true })).toBeEnabled();
  await page.getByRole('heading', { name: 'Teaching Memory', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/lessons-copy-separated-memory-1920.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Schedule lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Planned · ${today} · Version 1`, exact: true })).toBeVisible();
  await page.goto(`/plan/${a.lessonId}`);
  await expect(page.getByText('A prior use was rated 1 or 2 out of 5. Review these notes before reuse.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule lesson', exact: true })).toBeDisabled();
  await expect(page.getByText('A original feedback', { exact: true })).toHaveCount(2);
  const after = await get<LessonLibrary>(page.request, '/lessons');
  expect(after.teachingRecords).toEqual(before.teachingRecords); expect(after.reflections).toEqual(before.reflections);
  expect(after.versions.filter(v => v.lessonId === a.lessonId)).toEqual(before.versions);
  expect(errors).toEqual([]);
});

test('Manual draft without curriculum or sections stays empty, persists across reload and uses explicit dates', async ({ page }) => {
  await login(page); await page.goto('/plan/new');
  await page.getByLabel('Lesson title', { exact: true }).fill('Flexible intervention');
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Flexible intervention', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('No lesson sections written yet.', { exact: true })).toBeVisible();
  const library = await get<LessonLibrary>(page.request, '/lessons'); expect(library.versions[0].curriculumVersionId).toBeNull(); expect(library.versions[0].sections).toEqual([]); expect(library.versions[0].readiness).toBe('draft');
  await page.getByLabel('Scheduled date', { exact: true }).fill(today); await page.getByRole('button', { name: 'Schedule lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Planned · ${today} · Version 1`, exact: true })).toBeVisible();
  await page.reload(); expect((await get<LessonLibrary>(page.request, '/lessons')).teachingRecords).toHaveLength(0);
});

test('Lesson HTTP routes reject unauthenticated, cross-origin, forged ownership and cross-user mutations', async ({ page, browser }) => {
  const f = await login(page); const lesson = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', input(f.assignments[0].id));
  const occurrence = await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: lesson.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false });
  const record = await post<{ id: string }>(page.request, `/lessons/${occurrence.id}/taught`, { taughtOn: today });
  const other = await browser.newContext(); const bob = await other.newPage(); await login(bob);
  expect((await get<LessonLibrary>(bob.request, '/lessons')).lessons).toEqual([]);
  for (const [path, data] of [
    ['/lessons', input(f.assignments[0].id)],
    [`/lessons/${lesson.lessonId}/versions`, { ...input(f.assignments[0].id), revision: 1, sourceVersionId: lesson.versionId }],
    ['/lessons/schedule', { id: randomUUID(), versionId: lesson.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false }],
    [`/lessons/${occurrence.id}/taught`, { taughtOn: today }],
    [`/lessons/${record.id}/reflection`, { revision: null, rating: 5, worked: '', change: '', reflection: '', pacing: '', materials: '', transitions: '' }],
  ] as const) expect((await bob.request.post(`${origin}/api${path}`, { headers, data })).status()).toBe(403);
  expect((await page.request.post(`${origin}/api/lessons`, { headers, data: { ...input(f.assignments[0].id), workspaceId: randomUUID() } })).status()).toBe(400);
  expect((await page.request.post(`${origin}/api/lessons`, { headers: { Origin: 'https://elsewhere.example' }, data: input(f.assignments[0].id) })).status()).toBe(403);
  await post(page.request, '/auth/sign-out', {}); expect((await page.request.get(`${origin}/api/lessons`)).status()).toBe(401);
  expect((await page.request.post(`${origin}/api/lessons`, { headers, data: input(f.assignments[0].id) })).status()).toBe(401);
  await other.close();
});

test('Stale lesson and reflection edits show conflicts; reloading recovers without rewriting earlier versions', async ({ page }) => {
  const f = await login(page); const l = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', input(f.assignments[0].id));
  await page.goto(`/plan/${l.lessonId}/revise?version=${l.versionId}`);
  await page.getByLabel('Lesson title', { exact: true }).fill('Stale edit');
  await post(page.request, `/lessons/${l.lessonId}/versions`, { ...input(f.assignments[0].id), sourceVersionId: l.versionId, revision: 1, title: 'Other tab edit' });
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect((await get<LessonLibrary>(page.request, '/lessons')).versions).toHaveLength(2);
  await page.getByRole('button', { name: 'Reload lessons', exact: true }).click();
  await expect(page.getByLabel('Lesson title', { exact: true })).toHaveValue('Manual plan');
  await page.getByLabel('Lesson title', { exact: true }).fill('Third version');
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Third version', exact: true })).toBeVisible();
  const occurrence = await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: l.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false });
  const record = await post<{ id: string }>(page.request, `/lessons/${occurrence.id}/taught`, { taughtOn: today });
  const r = { revision: null, rating: 4, worked: 'Original reflection', change: '', reflection: '', pacing: '', materials: '', transitions: '' };
  await post(page.request, `/lessons/${record.id}/reflection`, r); await page.reload();
  await page.getByRole('button', { name: 'Edit reflection', exact: true }).click(); await page.getByRole('textbox', { name: 'What worked', exact: true }).fill('Stale reflection');
  await post(page.request, `/lessons/${record.id}/reflection`, { ...r, revision: 1, worked: 'Other tab reflection' });
  await page.getByRole('button', { name: 'Save reflection', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect((await get<LessonLibrary>(page.request, '/lessons')).reflections[0].worked).toBe('Other tab reflection');
});

test('Changing Resource originals and active curriculum never changes a saved lesson through the HTTP provider', async ({ page }) => {
  const f = await login(page); const s = await seedCurriculum(page, f.assignments[0].id);
  const l = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', { ...input(f.assignments[0].id), curriculumVersionId: s.cv.id, curriculumBindingId: s.binding.id, resourceVersionIds: [s.original.id] });
  const before = await get<LessonLibrary>(page.request, '/lessons');
  await post(page.request, `/resources/${s.resource.id}/versions`, { revision: 1, original: { kind: 'file', fileName: 'replacement.csv', base64: Buffer.from('Topic\nDifferent patterns\n').toString('base64') } });
  const resources = await get<ResourceLibrary>(page.request, `/resources/${s.resource.id}`);
  const c2 = await post<{ id: string }>(page.request, `/resources/${s.resource.id}/curriculum`, { resourceVersionId: resources.versions[0].id, label: 'New patterns', effectiveFrom: today, effectiveTo: '2040-12-31', purposes: ['instructional_detail'], mapping: { sheet: 'CSV', firstRow: 2, lastRow: 2, columns: [{ field: 'topic', column: 'A' }] }, supersedesId: s.cv.id });
  await post(page.request, `/resources/${s.resource.id}/curriculum/${c2.id}/review`, { revision: 1, approve: true, decisions: { '2-A': 'accept' }, note: '', acknowledgeLimitations: true });
  await post(page.request, `/resources/${s.resource.id}/curriculum/${c2.id}/activate`, { assignmentId: f.assignments[0].id, expectedBindingId: s.binding.id });
  expect(await get<LessonLibrary>(page.request, '/lessons')).toEqual(before);
  await page.goto(`/plan/${l.lessonId}`); await expect(page.getByRole('link', { name: 'Reviewed patterns · exact saved curriculum & source →', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Revise lesson', exact: true }).click();
  await page.getByRole('combobox', { name: 'Curriculum for this revision', exact: true }).selectOption('active');
  await expect(page.getByRole('heading', { name: 'New patterns', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save lesson version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manual plan', exact: true })).toBeVisible();
  const after = await get<LessonLibrary>(page.request, '/lessons'); expect(after.versions.find(v => v.id === l.versionId)).toEqual(before.versions[0]); expect(after.versions[0].curriculumVersionId).toBe(c2.id);
  expect(after.resourceLinks.every(link => link.resourceVersionId === s.original.id)).toBe(true);
});

test('Reflection save failure is visible beside the form at 1920×1080 and keeps the teacher draft', async ({ page }) => {
  const f = await login(page);
  const l = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', {
    ...input(f.assignments[0].id), title: 'Four Corners Academic Review', readiness: 'ready',
    sections: Array.from({ length: 10 }, (_, i) => ({ kind: `test.section_${i}`, label: `Teacher section ${i + 1}`, content: 'Teacher-authored directions.\n'.repeat(5), audience: 'instruction' })),
  });
  const o = await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: l.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false });
  const t = await post<{ id: string }>(page.request, `/lessons/${o.id}/taught`, { taughtOn: today });
  await page.goto(`/plan/${l.lessonId}`);
  const use = page.locator(`#use-${o.id}`);
  await use.getByRole('button', { name: 'Add reflection', exact: true }).click();
  await use.getByRole('textbox', { name: 'What worked', exact: true }).fill('Keep this unsaved teacher note.');
  const error = 'Lessons are unavailable. Check that the Increment 3 migration has been applied.';
  await page.route(`**/api/lessons/${t.id}/reflection`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error }) }));
  const response = page.waitForResponse(r => r.url().endsWith(`/${t.id}/reflection`) && r.request().method() === 'POST');
  await use.getByRole('button', { name: 'Save reflection', exact: true }).click();
  expect((await response).status()).toBe(503);
  await expect(page.getByRole('alert')).toContainText(error);
  await page.screenshot({ path: 'test-results/lessons-reflection-failure-1920.png' });
  await expect(use.getByRole('alert')).toContainText(error);
  await expect(use.getByRole('alert')).toBeInViewport();
  await expect(use.getByRole('textbox', { name: 'What worked', exact: true })).toHaveValue('Keep this unsaved teacher note.');
  expect((await get<LessonLibrary>(page.request, '/lessons')).reflections).toHaveLength(0);
  await page.unroute(`**/api/lessons/${t.id}/reflection`);
  const before = await get<LessonLibrary>(page.request, '/lessons');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/lessons/${t.id}/reflection`, async route => { await pending; await route.continue(); });
  const retry = page.waitForResponse(r => r.url().endsWith(`/${t.id}/reflection`) && r.request().method() === 'POST');
  await use.getByRole('button', { name: 'Save reflection', exact: true }).click();
  await expect(use.getByRole('button', { name: 'Saving reflection…', exact: true })).toBeDisabled();
  release(); expect((await retry).status()).toBe(200);
  await expect(use.getByRole('status')).toContainText('Reflection saved');
  await expect(use.getByRole('status')).toBeInViewport();
  await page.screenshot({ path: 'test-results/lessons-reflection-saved-1920.png' });
  const after = await get<LessonLibrary>(page.request, '/lessons');
  expect(after.reflections).toHaveLength(1); expect(after.reflections[0]).toMatchObject({ teachingRecordId: t.id, worked: 'Keep this unsaved teacher note.' });
  expect(after.versions).toEqual(before.versions); expect(after.occurrences).toEqual(before.occurrences); expect(after.teachingRecords).toEqual(before.teachingRecords);
  await page.reload(); await expect(use.getByText('Keep this unsaved teacher note.', { exact: true })).toBeVisible();
});

test('A saved reflection remains visibly confirmed when the following library refresh fails', async ({ page }) => {
  const f = await login(page); const l = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', input(f.assignments[0].id));
  const o = await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: l.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false });
  await post(page.request, `/lessons/${o.id}/taught`, { taughtOn: today });
  await page.goto(`/plan/${l.lessonId}`); const use = page.locator(`#use-${o.id}`);
  await use.getByRole('button', { name: 'Add reflection', exact: true }).click();
  await use.getByRole('textbox', { name: 'What worked', exact: true }).fill('Successfully stored before refresh failed.');
  await page.route('**/api/lessons', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Refresh unavailable' }) }) : route.continue());
  const write = page.waitForResponse(r => r.url().endsWith('/reflection') && r.request().method() === 'POST');
  await use.getByRole('button', { name: 'Save reflection', exact: true }).click(); expect((await write).status()).toBe(200);
  await expect(use.getByRole('alert')).toContainText('Saved, but refreshed lessons could not be loaded');
  await expect(use.getByRole('alert')).toBeInViewport();
  const saved = await get<LessonLibrary>(page.request, '/lessons'); expect(saved.reflections[0].worked).toBe('Successfully stored before refresh failed.');
  await page.unroute('**/api/lessons'); await page.reload();
  await expect(use.getByText('Successfully stored before refresh failed.', { exact: true })).toBeVisible();
  expect((await get<LessonLibrary>(page.request, '/lessons')).reflections).toHaveLength(1);
});

test('Repeated scheduling creates separate uses; marking one taught keeps one card per occurrence and links its memory', async ({ page }) => {
  const f = await login(page); const l = await post<{ lessonId: string; versionId: string }>(page.request, '/lessons', input(f.assignments[0].id));
  const occurrences = [];
  for (let i = 0; i < 2; i++) occurrences.push(await post<{ id: string }>(page.request, '/lessons/schedule', { id: randomUUID(), versionId: l.versionId, assignmentId: f.assignments[0].id, scheduledOn: today, acknowledgeLowRating: false }));
  const before = await get<LessonLibrary>(page.request, '/lessons');
  await page.goto(`/plan/${l.lessonId}`);
  await page.locator(`#use-${occurrences[0].id}`).getByRole('button', { name: 'Mark taught', exact: true }).click();
  await expect(page.locator('.ct-lesson-use')).toHaveCount(2);
  await expect(page.locator(`#use-${occurrences[0].id}`).getByRole('heading', { name: /^Taught/ })).toBeVisible();
  await expect(page.locator(`#use-${occurrences[1].id}`).getByRole('heading', { name: /^Planned/ })).toBeVisible();
  const after = await get<LessonLibrary>(page.request, '/lessons'); expect(after.occurrences).toEqual(before.occurrences); expect(after.versions).toEqual(before.versions); expect(after.teachingRecords).toHaveLength(1);
  expect(after.teachingRecords[0].occurrenceId).toBe(occurrences[0].id);
  await expect(page.getByText('These are separate scheduled uses.', { exact: false })).toBeVisible();
  await expect(page.locator('.ct-memory-entry').getByRole('link', { name: 'View this taught use', exact: true })).toHaveAttribute('href', `/plan/${l.lessonId}?version=${l.versionId}#use-${occurrences[0].id}`);
});
