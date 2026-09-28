import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { FoundationData } from '../shared/contracts/foundation';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };

test.use({ baseURL: 'http://127.0.0.1:5174' });
const origin = 'http://127.0.0.1:5174';
const headers = { Origin: origin };
async function signIn(page: Page, email = `${randomUUID()}@example.test`) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page.getByRole('heading', { name: 'My Classroom', exact: true })).toBeVisible();
  return email;
}
async function records(page: Page): Promise<FoundationData> { const response = await page.request.get(`${origin}/api/foundation`); expect(response.ok()).toBe(true); return response.json(); }
async function post(page: Page, path: string, data: unknown) { const response = await page.request.post(`${origin}/api${path}`, { headers, data }); expect(response.ok(), await response.text()).toBe(true); }
async function establish(page: Page) {
  await post(page, '/school-years', { name: '2026–27', startsOn: '2026-08-01', endsOn: '2027-07-31' });
  const year = (await records(page)).schoolYears[0];
  for (const title of ['Economics', 'World History']) await post(page, '/assignments', { schoolYearId: year.id, title, jurisdiction: 'Georgia', district: 'Example district', school: 'Example high school', subject: 'Social studies', course: title, grades: ['11','12'], teachingRole: 'Teacher', schedule: 'Monday–Friday · Room 14', startsOn: year.startsOn, endsOn: year.endsOn, isActive: true });
  const data = await records(page);
  await page.request.patch(`${origin}/api/context`, { headers, data: { schoolYearId: year.id, assignmentId: data.assignments[0].id, revision: data.profile.revision } });
  await page.reload();
  return records(page);
}

test('Teacher acceptance workflow uses persisted profile, years, assignments, work and session recovery', async ({ page, browser }) => {
  await signIn(page);
  await expect(page.getByText('No open work items in this view.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Manage', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Taylor Teacher');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(['Development fixture', 'Teacher profile saved.']);
  await page.getByLabel('School year name').fill('2026–27');
  await page.getByLabel('School year starts').fill('2026-08-01');
  await page.getByLabel('School year ends').fill('2027-07-31');
  await page.getByRole('button', { name: 'Create school year', exact: true }).click();
  await page.getByLabel('Active school year', { exact: true }).selectOption({ label: '2026–27' });
  await expect(page.getByRole('status')).toContainText(['Development fixture', 'School year selected.']);
  await page.getByLabel('Assignment name', { exact: true }).fill('Economics · Period 1');
  await page.getByLabel('State / jurisdiction').fill('Georgia');
  await page.getByLabel('District', { exact: true }).fill('Example District');
  await page.getByLabel('School', { exact: true }).fill('Example High School');
  await page.getByLabel('Subject', { exact: true }).fill('Social studies');
  await page.getByLabel('Course', { exact: true }).fill('Economics');
  await page.getByLabel('Grades / grade bands').fill('11, 12');
  await page.getByLabel('Teaching role', { exact: true }).fill('Teacher');
  await page.getByLabel('Schedule / locations').fill('Monday–Friday, 9:00 · Room 14');
  await page.getByRole('button', { name: 'Create Teaching Assignment', exact: true }).click();
  await page.getByLabel('Active Teaching Assignment', { exact: true }).selectOption({ label: 'Economics · Period 1' });
  await page.getByRole('link', { name: 'My Classroom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Economics · Period 1', exact: true })).toBeVisible();
  await expect(page.getByText('Monday–Friday, 9:00 · Room 14', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Add work item', exact: true }).click();
  await page.getByLabel('What needs doing?').fill('Prepare supply-and-demand starter');
  await page.getByLabel('Due date', { exact: true }).fill('2026-09-28');
  await page.getByRole('button', { name: 'Save work item', exact: true }).click();
  await expect(page.getByText('Prepare supply-and-demand starter', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Prepare supply-and-demand starter', exact: true }).click();
  await page.getByText('Completed and closed (1)', { exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  const saved = await records(page);
  expect(saved.profile.displayName).toBe('Taylor Teacher');
  expect(saved.workItems[0].status).toBe('completed');
  expect(saved.workItems[0].assignmentId).toBe(saved.assignments[0].id);
  await page.reload();
  await expect(page.getByLabel('Active Teaching Assignment')).toHaveValue(saved.assignments[0].id);
  const reopened = await browser.newContext({ storageState: await page.context().storageState() });
  const fresh = await reopened.newPage();
  await fresh.goto(`${origin}/classroom`);
  await expect(fresh.getByText('Welcome back, Taylor Teacher.', { exact: false })).toBeVisible();
  await expect(fresh.getByText('Completed and closed (1)', { exact: true })).toBeVisible();
  await reopened.close();
  await page.screenshot({ path: 'test-results/classthread-my-classroom.png', fullPage: true });
});

test('Switching simultaneous assignments and school years never relabels historical work', async ({ page }) => {
  await signIn(page); const data = await establish(page);
  const [first, second] = data.assignments;
  await post(page, '/work-items', { title: 'Economics follow-up', description: '', assignmentId: first.id, dueOn: null, priority: 'normal' });
  await page.reload(); await expect(page.getByText('Economics follow-up', { exact: true })).toBeVisible();
  await page.getByLabel('Active Teaching Assignment').selectOption(second.id);
  await expect(page.getByText('Economics follow-up', { exact: true })).toHaveCount(0);
  await page.getByLabel('Show work from all assignments').check();
  await expect(page.locator('.ct-task').filter({ hasText: 'Economics follow-up' })).toContainText(first.title);
  await post(page, '/school-years', { name: '2027–28', startsOn: '2027-08-01', endsOn: '2028-07-31' });
  await page.reload(); await page.getByLabel('Active school year').selectOption({ label: '2027–28' });
  const switched = await records(page);
  expect(switched.profile.selectedAssignmentId).toBeNull();
  expect(switched.workItems[0].assignmentId).toBe(first.id);
  expect(switched.assignments.every(assignment => assignment.isActive)).toBe(true);
  expect(switched.assignments).toEqual(data.assignments);
});

test('Sign-in does not claim browser data; Games exit and reopen retain both active games and history', async ({ page }) => {
  await page.goto('/sign-in');
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, fixture.records);
  await signIn(page);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(fixture.records))).toEqual(fixture.records);
  expect(Object.keys(await records(page)).sort()).toEqual(['assignments','profile','schoolYears','user','workItems','workspace']);
  await page.goto('/games/jeopardy');
  await expect(page.getByRole('button', { name: 'Back to Board' })).toBeVisible();
  const jeopardy = await page.evaluate(() => localStorage.getItem('curricuplay.game.v1'));
  await page.getByRole('button', { name: 'My Classroom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Classroom', exact: true })).toBeVisible();
  await page.goto('/games/four-corners');
  await expect(page.getByText('Round 2 of 10', { exact: true })).toBeVisible();
  const corners = await page.evaluate(() => localStorage.getItem('curricuplay.four-corners.v1'));
  await page.getByRole('button', { name: 'My Classroom', exact: true }).click();
  await page.reload();
  await page.goto('/games/jeopardy');
  await expect(page.getByRole('button', { name: 'Back to Board' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.game.v1'))).toBe(jeopardy);
  await page.goto('/games/four-corners'); await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.four-corners.v1'))).toBe(corners);
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.sessions.v1'))).toBe(fixture.records['curricuplay.sessions.v1']);
  const backup = await page.evaluate(() => JSON.parse(localStorage.getItem('classthread.legacy-backup.v1')!).records);
  expect(backup).toEqual(fixture.records);
});

test('API rejects cross-user records, forged owner fields, stale revisions and cross-origin writes', async ({ page, browser }) => {
  await signIn(page); const data = await establish(page);
  await post(page, '/work-items', { title: 'Private task', description: '', assignmentId: data.assignments[0].id, dueOn: null, priority: 'normal' });
  const task = (await records(page)).workItems[0];
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  await other.goto(`${origin}/sign-in`);
  await other.request.post(`${origin}/api/auth/verify`, { headers, data: { email: `${randomUUID()}@example.test`, token: '123456' } });
  expect((await records(other)).workItems).toEqual([]);
  expect((await other.request.patch(`${origin}/api/work-items/${task.id}`, { headers, data: { status: 'completed', revision: 1 } })).status()).toBe(404);
  expect((await other.request.post(`${origin}/api/work-items`, { headers, data: { title: 'Forged', description: '', assignmentId: data.assignments[0].id, dueOn: null, priority: 'normal' } })).status()).toBe(403);
  expect((await page.request.post(`${origin}/api/work-items`, { headers, data: { title: 'Forged', description: '', assignmentId: null, dueOn: null, priority: 'normal', workspaceId: randomUUID() } })).status()).toBe(400);
  expect((await page.request.patch(`${origin}/api/work-items/${task.id}`, { headers, data: { status: 'completed', revision: 1 } })).status()).toBe(200);
  expect((await page.request.patch(`${origin}/api/work-items/${task.id}`, { headers, data: { status: 'open', revision: 1 } })).status()).toBe(409);
  expect((await page.request.post(`${origin}/api/auth/email`, { headers: { Origin: 'https://untrusted.example' }, data: { email: 'teacher@example.test' } })).status()).toBe(403);
  await otherContext.close();
});

test('Sign-out clears teacher records without clearing Games and another account sees an empty workspace', async ({ page }) => {
  await signIn(page); await establish(page);
  await page.evaluate(() => localStorage.setItem('curricuplay.game.v1', 'preserve-this-device-record'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
  expect((await page.request.get(`${origin}/api/foundation`)).status()).toBe(401);
  await signIn(page);
  expect((await records(page)).assignments).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.game.v1'))).toBe('preserve-this-device-record');
});

test('All shell routes exist, future areas are labeled, and the dashboard fits a phone', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your lessons', exact: true })).toBeVisible();
  for (const name of ['Teach','Assess','Create','Evidence','Calendar']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByText('This part of ClassThread is planned for a later increment.', { exact: false })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/classroom'); await expect(page.getByRole('heading', { name: 'My Classroom', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/classthread-mobile.png', fullPage: true });
});

test('Invalid email code cannot create a session', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address', { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('999999');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  expect((await page.request.get(`${origin}/api/foundation`)).status()).toBe(401);
});
