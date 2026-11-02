import { test, expect, type Page } from '@playwright/test';
import { back, begin, end, familyKey, freshState, isQuickState, keepGoing, mondayOf, next, orderQueue, pool, quickTeamColors, reveal, scores, startOver, toggleTeam, toSession, winners, QUICK_CHECK_KEY, type QuickQuestion, type QuickState } from '../src/games/quick-check/engine';
import { classroomBank } from '../src/services/classroomPack';
import { bank as cornerBank } from '../src/games/four-corners/engine';
import { teamColors } from '../src/games/four-corners/teams';
import { bingoColors } from '../src/games/state-lingo-bingo/engine';
import { questionTaughtDate } from '../src/services/questionEngine';
import { isGameSession } from '../src/assessment/engine';
import { grades, type Grade } from '../src/types';
import type { Decisions } from '../src/services/questionReview';

const HISTORY = 'curricuplay.sessions.v1';
const FRIDAY = '2026-11-06';
const WEEK = mondayOf(FRIDAY);
const NOW = `${FRIDAY}T16:00:00.000Z`;
const source = new Map([...classroomBank.questions, ...cornerBank].map(q => [q.id, q]));
function days(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) out.push(d); return out; }
const label = (g: Grade) => g === 'K' ? 'Kindergarten' : `Grade ${g}`;
const packOf = (id: string) => (source.get(id) as { packId?: string }).packId ?? '';

async function open(page: Page, state?: QuickState) {
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.goto('/games/quick-check');
  if (state) { await page.evaluate(([key, value]) => localStorage.setItem(key, value), [QUICK_CHECK_KEY, JSON.stringify(state)]); await page.reload(); }
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), QUICK_CHECK_KEY) as Promise<QuickState>;
const history = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"sessions":[]}').sessions, HISTORY);
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
/** Play the whole list for a grade: Reveal, Next, until "every question". */
function playAll(s: QuickState, available: QuickQuestion[]) {
  while (!s.exhausted) s = next(reveal(s), available);
  return s;
}
/** A game showing one chosen question, so the screen can be checked deterministically. */
const seeded = (grade: Grade, first: QuickQuestion, teamCount = 0) => begin({ ...freshState(), asOf: FRIDAY, grade, teamCount }, [first], 'qc-test-session', NOW);

test('No future content: every Quick Check question for every grade and school day is approved, that grade, and already taught', () => {
  const violations: string[] = [];
  for (const date of days('2026-08-01', '2027-06-30')) for (const grade of grades) {
    const questions = pool(grade, date);
    for (const q of questions) {
      const original = source.get(q.id);
      if (!original) { violations.push(`${date} ${grade} ${q.id} not in an approved bank`); continue; }
      const taught = questionTaughtDate(original);
      if (original.grade !== grade || !taught || taught > date || q.taught !== taught || ['pending', 'needs-edit', 'rejected'].includes(original.reviewStatus ?? '')) violations.push(`${date} ${grade} ${q.id} taught ${taught}`);
    }
    for (const q of orderQueue(questions, [], date)) if (!questions.includes(q)) violations.push(`${date} ${grade} queued ${q.id} outside the pool`);
  }
  expect(violations).toEqual([]);
  // Nothing from the November batch shows before Monday Nov 2.
  expect(pool('3', '2026-10-30').some(q => packOf(q.id).endsWith('2026-11'))).toBe(false);
  expect(pool('3', FRIDAY).some(q => packOf(q.id).endsWith('2026-11'))).toBe(true);
});

test('Grade filtering and teacher vetoes: each grade gets only its own questions, from both banks, and vetoed questions never appear', () => {
  for (const grade of grades) {
    const questions = pool(grade, FRIDAY);
    expect(questions.length).toBeGreaterThan(10);
    expect(questions.every(q => source.get(q.id)!.grade === grade)).toBe(true);
    expect(new Set(questions.map(q => q.bank))).toEqual(new Set(['jeopardy', 'four-corners']));
  }
  const victim = pool('2', FRIDAY).find(q => q.bank === 'jeopardy')!;
  const veto: Decisions = { [victim.id]: { status: 'rejected', original: '{}', question: '', answer: '', reviewedAt: '' } };
  expect(pool('2', FRIDAY, veto).map(q => q.id)).not.toContain(victim.id);
});

test('Four Corners questions carry exactly four distinct choices with the answer among them', () => {
  for (const grade of grades) for (const q of pool(grade, FRIDAY).filter(q => q.bank === 'four-corners')) {
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices![q.correctIndex!]).toBe(q.answer);
  }
  expect(pool('4', FRIDAY).filter(q => q.bank === 'jeopardy').every(q => q.choices === undefined)).toBe(true);
});

test('No limit: this week’s questions first, then review, no repeats, until the whole bank is used; then the list can start over', () => {
  for (const grade of grades) {
    const available = pool(grade, FRIDAY);
    const s = playAll(begin({ ...freshState(), asOf: FRIDAY, grade }, available, 'id', NOW), available);
    const asked = s.asked, week = asked.filter(q => q.taught >= WEEK).length;
    expect(week).toBeGreaterThan(0);
    expect(asked.slice(0, week).every(q => q.taught >= WEEK)).toBe(true); // every this-week question comes first
    expect(asked.slice(week).every(q => q.taught < WEEK)).toBe(true);
    expect(new Set(asked.map(q => familyKey(q.id))).size).toBe(asked.length); // no repeats, not even a Four Corners copy of a Jeopardy question
    expect(new Set(asked.map(q => familyKey(q.id)))).toEqual(new Set(available.map(q => familyKey(q.id)))); // the whole bank
    expect(s.exhausted).toBe(true);
    expect(next(s, available)).toBe(s);
    // Start the list over: a second pass, again this week first, with its own keys.
    const again = startOver(s, available);
    expect(again.exhausted).toBe(false);
    expect(again.asked).toHaveLength(asked.length + 1);
    expect(again.asked.at(-1)!.key).toBe(`${again.asked.at(-1)!.id}~2`);
    expect(again.asked.at(-1)!.taught >= WEEK).toBe(true);
  }
});

test('Across games: a new game continues with questions not used yet, and starts the list over once the grade’s bank is used up', () => {
  const available = pool('3', FRIDAY);
  let s = begin({ ...freshState(), asOf: FRIDAY, grade: '3' }, available, 'a', NOW);
  for (let i = 0; i < 9; i++) s = next(reveal(s), available);
  const first = s.asked.map(q => familyKey(q.id));
  const second = begin({ ...end(s, NOW), screen: 'setup' }, available, 'b', NOW);
  expect(first).not.toContain(familyKey(second.asked[0].id));
  const used = playAll(second, available);
  expect(new Set([...first, ...used.asked.map(q => familyKey(q.id))]).size).toBe(first.length + used.asked.length);
  // Everything is used now, so the next game starts the list over with this week's questions.
  const third = begin({ ...used, screen: 'setup' }, available, 'c', NOW);
  expect(third.asked[0].taught >= WEEK).toBe(true);
  expect(third.seen['3']!.length).toBeLessThan(5);
});

test('Scoring rules: marks need Reveal, a second tap clears, Back keeps marks, End and Keep going, ties allowed', () => {
  const available = pool('5', FRIDAY);
  let s = begin({ ...freshState(), asOf: FRIDAY, grade: '5', teamCount: 3, names: ['Eagles', ...Array(7).fill('')] }, available, 'id', NOW);
  expect(s.teams!.map(t => t.name)).toEqual(['Eagles', 'Purple', 'Green']);
  expect(toggleTeam(s, 'team-1')).toBe(s); // not revealed yet
  expect(next(s, available)).toBe(s); // Next only after Reveal
  s = toggleTeam(toggleTeam(reveal(s), 'team-1'), 'team-2');
  s = toggleTeam(s, 'team-2');
  expect(scores(s).map(t => t.score)).toEqual([1, 0, 0]);
  s = toggleTeam(reveal(next(s, available)), 'team-2');
  const rewound = back(back(s));
  expect(rewound.index).toBe(0);
  expect(scores(rewound).map(t => t.score)).toEqual([1, 1, 0]);
  expect(next(rewound, available).index).toBe(1); // forward again to the question already asked, not a new one
  expect(next(rewound, available).asked).toHaveLength(2);
  expect(winners(s).map(t => t.name)).toEqual(['Eagles', 'Purple']);
  const ended = end(s, `${FRIDAY}T16:05:00.000Z`);
  expect(ended.screen).toBe('complete');
  expect(isQuickState(ended)).toBe(true);
  const session = toSession(ended)!;
  expect(isGameSession(session)).toBe(true);
  expect(session).toMatchObject({ gameType: 'quick-check', grade: '5', mode: 'team' });
  expect(session.questions).toHaveLength(2);
  expect(session.responses.filter(r => r.correct).map(r => r.teamId)).toEqual(['team-1', 'team-2']);
  const resumed = keepGoing(ended);
  expect([resumed.screen, resumed.endedAt, isQuickState(resumed)]).toEqual(['play', undefined, true]);
});

test('Team colors match the other games', () => {
  expect(quickTeamColors.slice(0, 6)).toEqual(teamColors);
  expect(quickTeamColors.map(c => c.accent)).toEqual(bingoColors.slice(0, 8));
});

test('Teams Off: grade then Start, a running question count, Reveal then Next, Back, End at any time, saved to Session History', async ({ page }) => {
  await open(page);
  await expect(page.locator('legend')).toHaveText(['Grade', 'Teams']); // no question limit setting
  await expect(page.getByRole('button', { name: 'Teams off' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Start →' })).toBeDisabled();
  await page.getByRole('button', { name: 'Grade 1', exact: true }).click();
  await page.getByRole('button', { name: 'Start →' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 1');
  await expect(page.locator('.qc-scorebar, .qc-mark')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '← Back' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'End', exact: true })).toBeVisible();
  for (let i = 0; i < 7; i++) {
    const state = await saved(page);
    await expect(page.getByTestId('qc-progress')).toHaveText(`Question ${i + 1}`);
    await expect(page.locator('.qc-prompt h1')).toHaveText(state.asked[i].question);
    await expect(page.getByRole('button', { name: 'Next →' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    await expect(page.locator('.qc-game')).toContainText(state.asked[i].answer);
    if (i === 1) {
      // Back hides the answer, then returns to the previous question.
      await page.getByRole('button', { name: '← Back' }).click();
      await expect(page.getByRole('button', { name: 'Reveal', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '← Back' }).click();
      await expect(page.getByTestId('qc-progress')).toHaveText('Question 1');
      await page.getByRole('button', { name: 'Next →' }).click();
      await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    }
    if (i < 6) await page.getByRole('button', { name: 'Next →' }).click();
  }
  const asked = (await saved(page)).asked;
  expect(asked).toHaveLength(7);
  expect(asked.every(q => source.get(q.id)!.grade === '1' && q.taught <= FRIDAY)).toBe(true);
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nice work!' })).toBeVisible();
  await expect(page.locator('.qc-summary li')).toHaveCount(7);
  for (const q of asked) await expect(page.locator('.qc-summary')).toContainText(q.answer);
  await expect(page.locator('.qc-final, [data-testid=qc-winner]')).toHaveCount(0);
  let sessions = await history(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ gameType: 'quick-check', grade: '1', mode: 'classic', teams: [], responses: [] });
  expect(sessions[0].questions).toHaveLength(7);
  await page.reload();
  expect(await history(page)).toHaveLength(1); // a refresh never saves a second copy
  // Keep going undoes an accidental End; ending again replaces the same record.
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 7');
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 8');
  await page.getByRole('button', { name: 'End', exact: true }).click();
  sessions = await history(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0].questions).toHaveLength(8);
  await page.getByRole('button', { name: 'Session History' }).click();
  await expect(page.getByRole('dialog')).toContainText('Quick Check');
});

test('When the grade’s whole bank is used: “That’s every question for now!”, then Start the list over keeps the game going', async ({ page }) => {
  const available = pool('2', FRIDAY);
  const s = { ...begin({ ...freshState(), asOf: FRIDAY, grade: '2' }, available, 'qc-all', NOW), queue: [] }; // the last question of the list
  await open(page, s);
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByRole('heading', { name: 'That’s every question for now!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End', exact: true })).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Start the list over' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 2');
  const after = await saved(page);
  expect(after.pass).toBe(2);
  expect(after.asked[1].taught >= WEEK).toBe(true);
  expect(after.queue.length).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.locator('.qc-summary li')).toHaveCount(2);
  expect((await history(page))[0].questions).toHaveLength(2);
});

test('Teams On: rename, tap correct teams after Reveal (second tap clears), score bar below the question, End shows winner and scores', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Grade 4', exact: true }).click();
  await page.getByRole('button', { name: '3 teams' }).click();
  await expect(page.getByLabel(/Name for team/)).toHaveCount(3);
  await page.getByLabel('Name for team 1').fill('Eagles');
  await page.getByRole('button', { name: 'Start →' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('Question 1');
  await expect(page.locator('.qc-scorebar')).toContainText('Eagles');
  await expect(page.locator('.qc-mark')).toHaveCount(0); // no marking before Reveal
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    const mark = page.locator('.qc-mark');
    await mark.getByRole('button', { name: /Eagles/ }).click();
    await expect(mark.getByRole('button', { name: /Eagles/ })).toHaveAttribute('aria-pressed', 'true');
    if (i === 0) {
      await mark.getByRole('button', { name: /Purple/ }).click();
      await expect(page.getByTestId('qc-score-team-2')).toContainText('1');
      await mark.getByRole('button', { name: /Purple/ }).click();
      await expect(mark.getByRole('button', { name: /Purple/ })).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('qc-score-team-2')).toContainText('0');
      // The score bar never covers the question or the controls.
      const [question, controls, bar] = await Promise.all(['.qc-prompt', '.qc-controls', '.qc-scorebar'].map(s => page.locator(s).boundingBox()));
      expect(question!.y + question!.height).toBeLessThanOrEqual(bar!.y);
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(bar!.y);
      await fits(page);
    }
    if (i < 2) await mark.getByRole('button', { name: /Green/ }).click();
    await expect(page.getByTestId('qc-score-team-1')).toContainText(String(i + 1));
    await page.getByRole('button', { name: 'Next →' }).click();
  }
  // End before revealing question 5: it was asked, so it is listed, with no points.
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nice work!' })).toBeVisible();
  await expect(page.locator('.qc-summary li')).toHaveCount(5);
  await expect(page.getByTestId('qc-winner')).toHaveText('Winner: Eagles');
  await expect(page.locator('.qc-final-scores')).toContainText('Eagles 4');
  await expect(page.locator('.qc-final-scores')).toContainText('Green 2');
  const [session] = await history(page);
  expect(session).toMatchObject({ gameType: 'quick-check', grade: '4', mode: 'team' });
  expect(session.teams.map((t: { name: string; accent: string }) => [t.name, t.accent])).toEqual([['Eagles', '#fb923c'], ['Purple', '#c084fc'], ['Green', '#4ade80']]);
  expect(session.responses).toHaveLength(15);
  expect(session.responses.filter((r: { teamId: string; correct: boolean }) => r.correct && r.teamId === 'team-1')).toHaveLength(4);
  expect(session.responses.filter((r: { teamId: string; correct: boolean }) => r.correct && r.teamId === 'team-3')).toHaveLength(2);
});

test('Selected buttons are solid white with navy text and a ✓, with no fade, at rest, on hover and after a tap', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Grade 3', exact: true }).click();
  await page.getByRole('button', { name: '4 teams' }).click();
  for (const name of ['Grade 3', '4 teams']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.hover();
    const style = await button.evaluate(e => { const s = getComputedStyle(e), b = getComputedStyle(e, '::before'); return { bg: s.backgroundColor, color: s.color, opacity: s.opacity, transition: s.transitionDuration, mark: b.content }; });
    expect(style).toEqual({ bg: 'rgb(255, 255, 255)', color: 'rgb(11, 31, 68)', opacity: '1', transition: '0s', mark: '"✓ " / ""' });
  }
  // Unselected buttons stay outlined, with white text on navy.
  expect(await page.getByRole('button', { name: 'Teams off' }).evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color])).toEqual(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']);
  await page.getByRole('button', { name: 'Start →' }).click();
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  const team = page.locator('.qc-mark button').first();
  await team.click();
  expect(await team.evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color])).toEqual(['rgb(255, 255, 255)', 'rgb(11, 31, 68)']);
});

test('Four Corners questions show four numbered choices, identical until Reveal; Read it to me is offered for K–2 only', async ({ page }) => {
  const corner = pool('2', FRIDAY).find(q => q.bank === 'four-corners' && !q.visual)!;
  await open(page, seeded('2', corner));
  const choices = page.locator('.qc-choice');
  await expect(choices).toHaveCount(4);
  await expect(choices.locator('b')).toHaveText(['1', '2', '3', '4']);
  await expect(choices.locator('span')).toHaveText(corner.choices!);
  await expect(page.locator('.qc-correct, .qc-check')).toHaveCount(0);
  expect(new Set(await choices.evaluateAll(els => els.map(e => e.className + getComputedStyle(e).backgroundColor + getComputedStyle(e).borderColor))).size).toBe(1);
  await expect(page.getByRole('button', { name: 'Read it to me' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  await expect(page.locator('.qc-correct')).toHaveCount(1);
  await expect(choices.nth(corner.correctIndex!)).toHaveClass(/qc-correct/);
  await expect(choices.nth(corner.correctIndex!)).toContainText('✓ Correct');
  await fits(page);

  const older = pool('3', FRIDAY).find(q => q.bank === 'jeopardy')!;
  await open(page, seeded('3', older));
  await expect(page.locator('.qc-prompt h1')).toHaveText(older.question);
  await expect(page.locator('.qc-choice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read it to me' })).toHaveCount(0);
});

for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720]]) test(`Setup fits one screen with no scrolling at ${width}×${height}, even with 8 named teams`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await open(page);
  await page.getByRole('button', { name: 'Kindergarten', exact: true }).click();
  await page.getByRole('button', { name: '8 teams' }).click();
  await expect(page.getByLabel(/Name for team/)).toHaveCount(8);
  await fits(page);
  await expect(page.getByRole('button', { name: 'Start →' })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Start →' }).click();
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  await fits(page);
  for (const locator of [page.locator('.qc-scorebar'), page.getByRole('button', { name: 'Next →' }), page.getByRole('button', { name: 'End', exact: true })]) await expect(locator).toBeInViewport({ ratio: 1 });
  // End and Next are separate targets with at least 16px between them.
  const [endBox, nextBox] = await Promise.all([page.getByRole('button', { name: 'End', exact: true }).boundingBox(), page.getByRole('button', { name: 'Next →' }).boundingBox()]);
  expect(nextBox!.x - (endBox!.x + endBox!.width)).toBeGreaterThanOrEqual(16);
});

test('Quick Check is the first game on the hub and opens setup', async ({ page }) => {
  await open(page);
  await page.goto('/games');
  await expect(page.locator('.game-card.live strong').first()).toHaveText('QUICK CHECK');
  await page.locator('.game-card.live').first().click();
  await expect(page).toHaveURL(/\/games\/quick-check$/);
  await expect(page.getByRole('heading', { name: 'A quick review to end class.' })).toBeVisible();
  for (const g of grades) await expect(page.getByRole('button', { name: label(g), exact: true })).toBeVisible();
});
