import { test, expect } from '@playwright/test';
// Isolate the long-term draft workflow from the independently tested classroom pack.
test.beforeEach(async ({ page }) => { await page.route("**/src/data/tomorrow-pack.json*", route => route.fulfill({ contentType: "application/javascript", body: "export default []" })); });

import questions from '../src/data/questions.json' with { type: 'json' };

test('Kindergarten review leads to a reserved 30-tile trial, with Review first and refresh', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/#review');
  await expect(page.getByLabel('Grade', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(31);
  await page.getByLabel('Grade', { exact: true }).selectOption('K');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(36);
  await expect(page.getByText('1 of 36 matching questions')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Source and evidence' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start 30-tile classroom trial' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Advance to next/ }).check();
  // Explicit teacher actions occur ONLY inside this isolated test browser.
  for (let i = 0; i < 36; i++) {
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    if (i === 28) await expect(page.getByRole('button', { name: 'Start 30-tile classroom trial' })).toBeDisabled();
  }
  await expect(page.getByText('Kindergarten — 36 Approved / 36 Generated / 60 Target')).toBeVisible();
  await page.getByLabel('Trial content range').selectOption('recent');
  await expect(page.getByRole('button', { name: 'Start 30-tile classroom trial' })).toBeDisabled();
  await page.getByLabel('Trial content range').selectOption('all');
  await page.getByLabel('Changes since human review').selectOption('');
  await page.getByLabel('Jump to a draft').selectOption(questions.find(q => q.grade === 'K')!.id);
  await expect(page.getByText(/SELF-CONTAINED — no external/).first()).toBeVisible();
  await expect(page.getByText(/EXTERNAL CLASSROOM MATERIAL REQUIRED — EXCLUDED/)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/kindergarten-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Start 30-tile classroom trial' }).click();
  const assigned = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!).assignments);
  expect(Object.keys(assigned)).toHaveLength(30);
  expect(new Set(Object.values(assigned)).size).toBe(30);
  await page.screenshot({ path: 'test-results/kindergarten-trial.png' });
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    await expect(page.locator('.tile:not([disabled])')).toHaveCount(30 - i);
    // Reverse order deliberately spends the Review category before subject tiles.
    await page.locator('.tile:not([disabled])').last().click();
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!));
    const q = questions.find(q => q.id === s.current.questionId)!;
    expect(q.grade).toBe('K'); expect(q.weekIntroduced <= '2026-09-13').toBe(true);
    expect(s.assignments[s.current.tileId]).toBe(q.id);
    expect(seen.has(q.id)).toBe(false); seen.add(q.id);
    await expect(page.getByText('TEACHER READS QUESTION ALOUD')).toBeVisible();
    if (i === 0) { await page.reload(); await expect(page.getByRole('heading', { name: q.question, exact: true })).toBeVisible(); }
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Back to Board' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
  expect(seen.size).toBe(30);
  await expect(page.locator('.tile.used[disabled]')).toHaveCount(30);
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Game', exact: true }).click();
  await expect(page.locator('.tile:not([disabled])')).toHaveCount(30);
  expect(errors).toEqual([]);
});

test('Planner handles exactly 30, shortages, shared pools, and excluded review states/dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  const result = await page.evaluate(async qs => {
    // @ts-expect-error Vite module
    const { createQuestionEngine } = await import('/src/services/questionEngine.ts');
    // @ts-expect-error Vite module
    const { tiles } = await import('/src/games/jeopardy/board.ts');
    const all = qs.filter(q => q.grade === 'K').map(q => ({ ...q, reviewStatus: 'approved' }));
    const slots = tiles.map((t: { id: string; category: string; difficulty: number }) => ({ id: t.id, filters: { grade: 'K', range: 'all', asOf: '2026-09-13', subject: t.category, difficulty: t.difficulty } }));
    const first = createQuestionEngine(all).planQuestions(slots);
    const subset = all.filter(q => Object.values(first.assignments).includes(q.id));
    const exactly = createQuestionEngine(subset).planQuestions(slots, true);
    const pending = createQuestionEngine(subset.map((q, i) => i === 0 ? { ...q, reviewStatus: 'pending' } : q)).planQuestions(slots);
    const rejected = createQuestionEngine(subset.map((q, i) => i === 0 ? { ...q, reviewStatus: 'rejected' } : q)).planQuestions(slots);
    const future = createQuestionEngine(subset.map((q, i) => i === 0 ? { ...q, weekIntroduced: '2026-09-14', alignedWeeks: ['2026-09-14'] } : q)).planQuestions(slots);
    const unbalanced = createQuestionEngine(all.filter(q => q.subject !== 'Science')).planQuestions(slots);
    return { exactly: exactly.complete, unique: new Set(Object.values(exactly.assignments)).size, pending: pending.complete, rejected: rejected.complete, future: future.complete, unbalanced: unbalanced.complete };
  }, questions);
  expect(result).toEqual({ exactly: true, unique: 30, pending: false, rejected: false, future: false, unbalanced: false });
});

test('A withdrawn approval invalidates a reserved saved trial instead of exposing an unavailable tile', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  await page.evaluate(async qs => {
    // @ts-expect-error Vite module
    const review = await import('/src/services/questionReview.ts');
    // @ts-expect-error Vite module
    const { createQuestionEngine } = await import('/src/services/questionEngine.ts');
    // @ts-expect-error Vite module
    const { tiles } = await import('/src/games/jeopardy/board.ts');
    const selected = qs.filter(q => q.grade === 'K');
    selected.forEach(q => review.writeReview(q, 'approved', q.question, q.answer));
    const assignments = createQuestionEngine(selected.map(q => ({ ...q, reviewStatus: 'approved' }))).planQuestions(tiles.map((t: { id: string; category: string; difficulty: number }) => ({ id: t.id, filters: { grade: 'K', range: 'all', asOf: '2026-09-13', subject: t.category, difficulty: t.difficulty } }))).assignments;
    localStorage.setItem('curricuplay.game.v1', JSON.stringify({ version: 1, screen: 'board', selectedGame: 'jeopardy', grade: 'K', range: 'all', asOf: '2026-09-13', usedQuestionIds: [], usedTiles: [], current: null, assignments }));
    const removed = selected.find(q => q.id === assignments['Science-0'])!;
    review.writeReview(removed, 'rejected', removed.question, removed.answer);
  }, questions);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  await expect(page.locator('.tile')).toHaveCount(0);
});

test('First grade cannot launch a full board after quality withdrawals, even with all active drafts approved', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  await page.evaluate(async qs => {
    // @ts-expect-error Vite module
    const review = await import('/src/services/questionReview.ts');
    qs.filter(q => q.grade === '1').forEach(q => review.writeReview(q, 'approved', q.question, q.answer));
  }, questions);
  await page.goto('/#review'); await page.reload();
  await expect(page.getByRole('region', { name: 'Classroom trial readiness' })).toContainText('31 eligible approved questions · 25/30 tiles covered');
  await expect(page.getByRole('button', { name: 'Start 30-tile classroom trial' })).toBeDisabled();
  await page.getByLabel('Changes since human review').selectOption('');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(31);
  expect(questions.filter(q => q.grade === '1' && /pretend|city—|nation—|state—/.test(q.question))).toHaveLength(0);
});
