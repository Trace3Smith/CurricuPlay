import { test, expect } from '@playwright/test';
// Isolate the long-term draft workflow from the independently tested classroom pack.
test.beforeEach(async ({ page }) => { await page.route("**/src/data/tomorrow-pack.json*", route => route.fulfill({ contentType: "application/javascript", body: "export default []" })); });

import questions from '../src/data/questions.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher tools · Question Review' }).click();
});

test('Teacher edits and approves locally, refreshes, and withdraws approval; a single approval cannot launch', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.getByText('Kindergarten — 0 Approved / 36 Generated / 60 Target')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Source and evidence' })).toBeVisible();
  await page.getByLabel('Question', { exact: true }).fill('Teacher reviewed counting prompt.');
  await page.getByLabel('Answer', { exact: true }).fill('Teacher checked answer.');
  await page.getByRole('checkbox', { name: /My edits need no external/ }).check();
  await page.getByRole('button', { name: 'Edit & Approve', exact: true }).click();
  await expect(page.getByText('Kindergarten — 1 Approved / 36 Generated / 60 Target')).toBeVisible();
  await page.screenshot({ path: 'test-results/question-review-1920.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await page.getByRole('button', { name: /EVERYTHING TAUGHT SO FAR/ }).click();
  await expect(page.getByText('1 approved questions available')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Teacher tools · Question Review' }).click();
  await expect(page.getByLabel('Question', { exact: true })).toHaveValue('Teacher reviewed counting prompt.');
  await page.getByRole('button', { name: 'Needs Review', exact: true }).click();
  await expect(page.getByText('Kindergarten — 0 Approved / 36 Generated / 60 Target')).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('Filters, rejection, unsaved edits, and empty answers are handled', async ({ page }) => {
  await page.getByLabel('Grade', { exact: true }).selectOption('3');
  await page.getByLabel('Subject', { exact: true }).selectOption('Science');
  await page.getByLabel('Difficulty', { exact: true }).selectOption('2');
  await expect(page.getByText('1 of 2 matching questions')).toBeVisible();
  await page.getByLabel('Answer', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Question Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.getByLabel('Review status').selectOption('rejected');
  await expect(page.getByText('1 of 1 matching questions')).toBeVisible();
  await page.getByLabel('Review status').selectOption('approved');
  await expect(page.getByText('No matching questions', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Teacher tools · Question Review' }).click();
  await page.getByLabel('Review status').selectOption('rejected');
  await expect(page.getByLabel('Answer', { exact: true })).toHaveValue('');
});

test('Storage failures do not approve drafts; changed evidence invalidates decisions; future stays excluded', async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Full'); }; });
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText(/Review was not saved/)).toBeVisible();
  await expect(page.getByText('Kindergarten — 0 Approved / 36 Generated / 60 Target')).toBeVisible();
  await page.reload();
  const result = await page.evaluate(async q => {
    // @ts-expect-error Vite module
    const review = await import('/src/services/questionReview.ts');
    // @ts-expect-error Vite module
    const { createQuestionEngine } = await import('/src/services/questionEngine.ts');
    const d = review.writeReview(q, 'approved', q.question, q.answer).decisions;
    const changed = review.effectiveQuestion({ ...q, evidence: { ...q.evidence, quote: 'changed evidence' } }, d);
    const future = { ...q, weekIntroduced: '2027-01-01', alignedWeeks: ['2027-01-01'] };
    const fd = review.writeReview(future, 'approved', future.question, future.answer).decisions;
    return { changed: changed.reviewStatus, futureCount: createQuestionEngine([review.effectiveQuestion(future, fd)]).getAvailableQuestionCount({ grade: q.grade, range: 'all', asOf: '2028-01-01' }) };
  }, questions[0]);
  expect(result).toEqual({ changed: 'pending', futureCount: 0 });
});
