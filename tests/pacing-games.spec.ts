import { test, expect, type Page } from '@playwright/test';
import { classroomQuestions, classroomBank } from '../src/services/classroomPack';
import { createQuestionEngine, familyOf, questionStatus, questionTaughtDate } from '../src/services/questionEngine';
import { bank as cornerBank, eligible, mixes } from '../src/games/four-corners/engine';
import { tiles } from '../src/games/jeopardy/board';
import { grades, subjects, type Filters, type PacedRange, type Question } from '../src/types';
import type { Decisions } from '../src/services/questionReview';
import { planningAhead, PLANNING_AHEAD } from '../src/curriculum/pacing';

function days(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) out.push(d); return out; }
const year = days('2026-08-01', '2027-06-30');
const veto = (ids: string[], status: 'rejected' | 'needs-edit' | 'pending'): Decisions => Object.fromEntries(ids.map(id => [id, { status, original: '{}', question: '', answer: '', reviewedAt: '' }]));
const slots = (grade: Filters['grade'], asOf: string) => tiles.map(t => ({ id: t.id, ...(t.category === 'Review'
  ? { filters: { grade, asOf, range: 'mixed' as const, subject: t.category, difficulty: t.difficulty } }
  : { filters: { grade, asOf, range: 'current' as const, subject: t.category, difficulty: t.difficulty }, fallback: { grade, asOf, range: 'review' as const, subject: t.category, difficulty: t.difficulty } }) }));

test('no question is Current or Review before its taught date on any day of the school year, in either game', () => {
  const violations: string[] = [];
  for (const q of [...classroomBank.questions, ...cornerBank]) for (const date of year) {
    const status = questionStatus(q, date), taught = questionTaughtDate(q);
    if (!taught || (status && taught > date) || (!status && taught <= date)) violations.push(`${q.id} ${date} ${status}`);
  }
  expect(violations).toEqual([]);
  // Taught dates are Fridays of the latest aligned week; nothing in the bundled banks is taught after Sept 11.
  // Week-only questions count on Friday; an exact day recorded from a lesson plan is kept.
  for (const q of [...classroomBank.questions, ...cornerBank]) {
    if (q.taughtOn) expect(questionTaughtDate(q)).toBe(q.taughtOn);
    else expect(new Date(`${questionTaughtDate(q)}T12:00:00Z`).getUTCDay()).toBe(5);
  }
});

test('engine pools for both games never include untaught questions on any day, for every grade and content choice', () => {
  const questions = classroomQuestions({}), engine = createQuestionEngine(questions), violations: string[] = [];
  for (const date of year) for (const grade of grades) {
    for (const range of ['current', 'review', 'mixed'] as PacedRange[]) {
      for (const subject of [undefined, ...subjects, 'Review' as const]) for (const q of engine.getQuestions({ grade, range, asOf: date, subject, unused: false }))
        if (questionTaughtDate(q)! > date || q.grade !== grade) violations.push(`jeopardy ${date} ${grade} ${range} ${subject} ${q.id}`);
      for (const mix of mixes) for (const q of eligible(grade, mix, range, date))
        if (questionTaughtDate(q)! > date || q.grade !== grade || q.subject === 'Math') violations.push(`corners ${date} ${grade} ${range} ${mix} ${q.id}`);
    }
  }
  expect(violations).toEqual([]);
  expect(createQuestionEngine(questions).getAvailableQuestionCount({ grade: 'K', range: 'mixed', asOf: '2026-08-06' })).toBe(0);
  expect(eligible('K', 'Mixed Academic', 'mixed', '2026-08-06')).toEqual([]);
});

test('Sept 20 boundary: Current through Oct 19, Review from Oct 20; weekly items use the Friday', () => {
  const base = classroomBank.questions[0];
  const exact: Question = { ...base, weekIntroduced: '2026-09-14', alignedWeeks: undefined, taughtOn: '2026-09-20' };
  expect(questionTaughtDate(exact)).toBe('2026-09-20');
  expect(questionStatus(exact, '2026-09-19')).toBeNull();
  expect(questionStatus(exact, '2026-09-20')).toBe('current');
  expect(questionStatus(exact, '2026-10-19')).toBe('current');
  expect(questionStatus(exact, '2026-10-20')).toBe('review');
  const weekly: Question = { ...base, weekIntroduced: '2026-09-14', alignedWeeks: undefined, taughtOn: undefined };
  expect(questionTaughtDate(weekly)).toBe('2026-09-18');
  // A question aligned to several weeks counts as taught at the end of its latest aligned week.
  expect(questionTaughtDate({ ...weekly, weekIntroduced: '2026-08-10', alignedWeeks: ['2026-08-10', '2026-09-07'] })).toBe('2026-09-11');
  // Planning ahead: a later teaching date includes content not taught yet, still never past that date.
  const later: Question = { ...weekly, id: 'later', grade: 'K', reviewStatus: 'approved', weekIntroduced: '2026-11-09' };
  const engine = createQuestionEngine([later]);
  expect(engine.getQuestions({ grade: 'K', range: 'mixed', asOf: '2026-11-12', unused: false })).toEqual([]);
  expect(engine.getQuestions({ grade: 'K', range: 'current', asOf: '2026-11-13', unused: false }).map(q => q.id)).toEqual(['later']);
  expect(planningAhead('2026-10-19', '2026-10-18')).toBe(true);
  expect(planningAhead('2026-10-18', '2026-10-18')).toBe(false);
  expect(planningAhead('not-a-date', '2026-10-18')).toBe(false);
  expect(PLANNING_AHEAD).toBe('Planning ahead: this includes content not taught yet.');
});

test('Jeopardy boards stay complete when Current is empty and prefer Current where it exists', () => {
  const questions = classroomQuestions({}), engine = createQuestionEngine(questions);
  for (const grade of grades) {
    // Oct 18: nothing is Current (latest taught date is Sept 11), so every subject tile comes from Review.
    expect(engine.getAvailableQuestionCount({ grade, range: 'current', asOf: '2026-10-18' })).toBe(0);
    const empty = engine.planQuestions(slots(grade, '2026-10-18'), true);
    expect(empty.complete).toBe(true);
    for (const t of tiles.filter(t => t.category !== 'Review')) expect(questionStatus(questions.find(q => q.id === empty.assignments[t.id])!, '2026-10-18')).toBe('review');
    // Sept 20: Current exists; each subject/difficulty uses as many Current families as it has, up to its two tiles.
    const plan = engine.planQuestions(slots(grade, '2026-09-20'), true);
    expect(plan.complete).toBe(true);
    expect(new Set(Object.values(plan.assignments).map(id => familyOf(questions.find(q => q.id === id)!))).size).toBe(30);
    for (const subject of subjects) for (const difficulty of [1, 2, 3]) {
      const assigned = tiles.filter(t => t.category === subject && t.difficulty === difficulty).map(t => questions.find(q => q.id === plan.assignments[t.id])!);
      const currentFamilies = new Set(engine.getQuestions({ grade, subject, difficulty, range: 'current', asOf: '2026-09-20', unused: false }).map(familyOf)).size;
      expect(assigned.filter(q => questionStatus(q, '2026-09-20') === 'current').length).toBe(Math.min(2, currentFamilies));
    }
  }
});

test('teacher vetoes, withdrawn approvals, and external-material questions never appear on any date', () => {
  const vetoed = classroomBank.questions.filter((_, i) => i % 3 === 0).map(q => q.id);
  const withdrawn = classroomBank.questions.filter((_, i) => i % 3 === 1).map(q => q.id);
  const questions = classroomQuestions({ ...veto(vetoed.filter((_, i) => i % 2), 'rejected'), ...veto(vetoed.filter((_, i) => !(i % 2)), 'needs-edit'), ...veto(withdrawn, 'pending') });
  const external = { ...classroomBank.questions[2], id: 'external-only', requiresExternalClassroomMaterial: true };
  const engine = createQuestionEngine([...questions, external]), blocked = new Set([...vetoed, ...withdrawn, 'external-only']);
  for (const date of ['2026-08-07', '2026-09-11', '2026-09-20', '2026-10-18', '2027-06-30']) for (const grade of grades) for (const range of ['current', 'review', 'mixed'] as PacedRange[])
    expect(engine.getQuestions({ grade, range, asOf: date, unused: false }).filter(q => blocked.has(q.id))).toEqual([]);
});

test('Four Corners content choice splits Current and Review; Math stays excluded', () => {
  for (const grade of grades) for (const mix of mixes) {
    const current = eligible(grade, mix, 'current', '2026-09-20'), review = eligible(grade, mix, 'review', '2026-09-20'), both = eligible(grade, mix, 'mixed', '2026-09-20');
    expect(current.length + review.length).toBe(both.length);
    expect(both.some(q => q.subject === 'Math')).toBe(false);
    expect(eligible(grade, mix, 'current', '2026-10-18')).toEqual([]);
  }
});

const pinned = (page: Page, iso = '2026-10-18T16:00:00Z') => page.clock.setSystemTime(new Date(iso));

test('Jeopardy board on a date with no Current questions is complete, filled from Review, and says so plainly', async ({ page }) => {
  await pinned(page);
  await page.goto('/games'); await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await page.getByRole('button', { name: '3rd Grade', exact: true }).click();
  await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-18');
  await expect(page.getByText('No Current questions yet for 3rd Grade on this date. The board will use Review questions.')).toBeVisible();
  await expect(page.getByTestId('jeopardy-pacing-window')).toContainText('Current = taught Sept 19 – Oct 18');
  await expect(page.getByTestId('planning-ahead')).toHaveCount(0);
  await page.getByLabel('Teaching date').fill('2026-11-20');
  await expect(page.getByTestId('planning-ahead')).toHaveText('Planning ahead: this includes content not taught yet.');
  await page.getByLabel('Teaching date').fill('2026-10-18');
  await expect(page.getByTestId('planning-ahead')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.tile:not([disabled])')).toHaveCount(30);
  for (const subject of subjects) await expect(page.getByRole('region', { name: subject, exact: true }).locator('.tile[data-from-review]')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Review', exact: true }).locator('.tile[data-from-review]')).toHaveCount(0);
  await expect(page.getByText(/Current \+ Review · Teaching date 2026-10-18/)).toBeVisible();
  await page.getByRole('button', { name: /^Science 1 point opportunity 1 Review$/ }).click();
  // Subject tiles filled from Review look like any other tile; only the Review column is labelled Review.
  await expect(page.locator('.question-meta')).toHaveText(/^SCIENCE\s*1 POINT$/);
  await page.screenshot({ path: 'test-results/jeopardy-review-tags.png' });
});

test('Jeopardy on Sept 20 mixes Current and Review-filled tiles and keeps them after refresh', async ({ page }) => {
  await pinned(page, '2026-09-20T16:00:00Z');
  await page.goto('/games'); await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await page.getByRole('button', { name: 'Kindergarten', exact: true }).click();
  await expect(page.getByText(/No Current questions yet/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Game' }).click();
  const tags = await page.locator('.tile[data-from-review]').count();
  expect(tags).toBeLessThan(24);
  await page.screenshot({ path: 'test-results/jeopardy-current-review.png' });
  await page.reload();
  await expect(page.locator('.tile[data-from-review]')).toHaveCount(tags);
});

test('Four Corners offers Current, Review, and Current + Review with the teaching date', async ({ page }) => {
  await pinned(page);
  await page.goto('/games/four-corners');
  await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-18');
  for (const label of ['Current', 'Review', 'Current + Review']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Current + Review', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('fc-pacing-window')).toContainText('Current = taught Sept 19 – Oct 18');
  await expect(page.getByTestId('planning-ahead')).toHaveCount(0);
  await page.getByLabel('Teaching date').fill('2026-11-20');
  await expect(page.getByTestId('planning-ahead')).toHaveText('Planning ahead: this includes content not taught yet.');
  await expect(page.getByTestId('fc-pacing-window')).toContainText('Current = taught Oct 21 – Nov 20');
  await page.getByLabel('Teaching date').fill('2026-10-18');
  await expect(page.getByTestId('planning-ahead')).toHaveCount(0);
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await expect(page.getByText('0 eligible unique questions')).toBeVisible();
  await expect(page.getByText('No Current questions yet for Kindergarten on this date. Choose Review or Current + Review.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start Game/ })).toBeDisabled();
  await page.getByLabel('Teaching date').fill('2026-09-20');
  const current = eligible('K', 'Mixed Academic', 'current', '2026-09-20').length;
  await expect(page.getByText(`${current} eligible unique questions`)).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Play Until I Stop', exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.four-corners.v1')!));
  expect(saved.content).toBe('review'); expect(saved.asOf).toBe('2026-09-20');
  expect(saved.questionIds.every((id: string) => questionStatus(cornerBank.find(q => q.id === id)!, '2026-09-20') === 'review')).toBe(true);
  await page.reload(); await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
});

test('old saves load unchanged: a legacy Jeopardy board and a pre-pacing Four Corners game', async ({ page }) => {
  await pinned(page);
  const questions = classroomQuestions({});
  const legacyPlan = createQuestionEngine(questions).planQuestions(tiles.map(t => ({ id: t.id, filters: { grade: '2' as const, range: 'all' as const, asOf: '2026-09-13', subject: t.category, difficulty: t.difficulty } })));
  expect(legacyPlan.complete).toBe(true);
  const board = { version: 1, screen: 'board', selectedGame: 'jeopardy', grade: '2', range: 'all', asOf: '2026-09-13', usedQuestionIds: [], usedTiles: [], current: null, assignments: legacyPlan.assignments };
  const pool = eligible('1', 'Mixed Academic', 'mixed', '2026-10-18');
  const corners = { version: 1, screen: 'play', grade: '1', mix: 'Mixed Academic', rounds: 'all', mode: 'classic', currentRound: 0, questionIds: pool.map(q => q.id), usedQuestionIds: [pool[0].id], revealed: false };
  await page.addInitScript(([b, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('curricuplay.game.v1', b); localStorage.setItem('curricuplay.four-corners.v1', c); sessionStorage.setItem('seeded', '1'); } }, [JSON.stringify(board), JSON.stringify(corners)]);
  await page.goto('/games');
  await expect(page.getByRole('button', { name: /JEOPARDY/ })).toContainText('CONTINUE');
  await expect(page.getByRole('button', { name: /FOUR CORNERS/ })).toContainText('CONTINUE');
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page.getByText(/Everything taught so far · Through 2026-09-13/)).toBeVisible();
  await expect(page.locator('.tile:not([disabled])')).toHaveCount(30);
  await expect(page.locator('.tile[data-from-review]')).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!));
  expect(stored.assignments).toEqual(legacyPlan.assignments); expect(stored.range).toBe('all'); expect(stored.asOf).toBe('2026-09-13');
  await page.getByRole('button', { name: 'Math 1 point opportunity 1', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!).current.questionId)).toBe(legacyPlan.assignments['Math-0']);
  await page.goto('/games/four-corners');
  await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
  const fc = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.four-corners.v1')!));
  expect(fc.questionIds).toEqual(corners.questionIds); expect(fc.content).toBeUndefined(); expect(fc.asOf).toBeUndefined();
});
