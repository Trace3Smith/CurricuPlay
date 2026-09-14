import { test, expect } from '@playwright/test';
// Isolate the long-term draft workflow from the independently tested classroom pack.
test.beforeEach(async ({ page }) => { await page.route("**/src/data/tomorrow-pack.json*", route => route.fulfill({ contentType: "application/javascript", body: "export default []" })); });

import questions from '../src/data/questions.json' with { type: 'json' };

test('All excluded records are reviewable and filterable, but approval never makes them playable', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/#review');
  await page.getByLabel('Grade', { exact: true }).selectOption('');
  await page.getByLabel('Gameplay materials').selectOption('external');
  const excluded = questions.filter(q => q.requiresExternalClassroomMaterial);
  expect(excluded).toHaveLength(19);
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(19);
  for (const q of excluded) {
    await page.getByLabel('Jump to a draft').selectOption(q.id);
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue(q.question);
    await expect(page.getByText('EXTERNAL CLASSROOM MATERIAL REQUIRED — EXCLUDED FROM GAMEPLAY EVEN IF APPROVED')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Source and evidence' })).toContainText(q.evidence.quote);
  }
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByLabel('Grade', { exact: true }).selectOption('5');
  await expect(page.getByRole('region', { name: 'Classroom trial readiness' })).toContainText('0 eligible approved questions');
  await expect(page.getByRole('button', { name: 'Start 30-tile classroom trial' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/external-material-review.png', fullPage: true });
  await page.getByLabel('Gameplay materials').selectOption('self-contained');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(31);
});

test('Shared engine requires an explicit false flag and preserves teacher-read eligibility', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  const result = await page.evaluate(async qs => {
    // @ts-expect-error Vite module
    const { createQuestionEngine, validateQuestions } = await import('/src/services/questionEngine.ts');
    const approved = qs.map(q => ({ ...q, reviewStatus: 'approved' }));
    const engine = createQuestionEngine(approved);
    const counts = ['K','1','2','3','4','5'].map(grade => engine.getAvailableQuestionCount({ grade, range: 'all', asOf: '2026-09-13', unused: false }));
    const q = approved[0];
    const unknown = { ...q, requiresExternalClassroomMaterial: undefined };
    return { counts, excluded: engine.getQuestions({ grade: '3', subject: 'Social Studies', range: 'all', asOf: '2026-09-13' }).length,
      unknownCount: createQuestionEngine([unknown]).getAvailableQuestionCount({ grade: q.grade, range: 'all', asOf: '2026-09-13' }),
      invalid: validateQuestions([unknown]).errors.length > 0,
      teacherRead: createQuestionEngine([{ ...q, teacherRead: true }]).getAvailableQuestionCount({ grade: q.grade, range: 'all', asOf: '2026-09-13' }) };
  }, questions);
  expect(result).toEqual({ counts: [36,31,34,30,30,31], excluded: 0, unknownCount: 0, invalid: true, teacherRead: 1 });
});
