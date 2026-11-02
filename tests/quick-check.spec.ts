import { test, expect, type Page } from '@playwright/test';
import { back, begin, freshState, next, pool, quickTeamColors, reveal, scores, selectQuestions, toggleTeam, toSession, winners, isQuickState, QUICK_CHECK_KEY, type QuickQuestion, type QuickState } from '../src/games/quick-check/engine';
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
const source = new Map([...classroomBank.questions, ...cornerBank].map(q => [q.id, q]));
function days(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) out.push(d); return out; }
const label = (g: Grade) => g === 'K' ? 'Kindergarten' : `Grade ${g}`;

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
/** A game whose first question is a given one, so the screen can be checked deterministically. */
function seeded(grade: Grade, first: QuickQuestion, teamCount = 0): QuickState {
  const rest = pool(grade, FRIDAY).filter(q => q.id !== first.id).slice(0, 4);
  return begin({ ...freshState(), asOf: FRIDAY, grade, teamCount }, [first, ...rest], [], 'qc-test-session', `${FRIDAY}T16:00:00.000Z`);
}

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
    for (const q of selectQuestions(questions, 10, [], date).questions) if (!questions.includes(q)) violations.push(`${date} ${grade} picked ${q.id} outside the pool`);
  }
  expect(violations).toEqual([]);
  // Nothing from the November batch shows before Monday Nov 2.
  expect(pool('3', '2026-10-30').some(q => (source.get(q.id) as { packId?: string }).packId?.endsWith('2026-11'))).toBe(false);
  expect(pool('3', FRIDAY).some(q => (source.get(q.id) as { packId?: string }).packId?.endsWith('2026-11'))).toBe(true);
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
  // Jeopardy questions are open answer.
  expect(pool('4', FRIDAY).filter(q => q.bank === 'jeopardy').every(q => q.choices === undefined)).toBe(true);
});

test('Selection prefers this week’s content, mixes in review, and avoids repeats until the grade’s bank runs out', () => {
  for (const grade of grades) {
    const questions = pool(grade, FRIDAY), week = questions.filter(q => q.taught >= '2026-11-02');
    const picked = selectQuestions(questions, 10, [], FRIDAY).questions;
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map(q => q.id)).size).toBe(10);
    expect(picked.filter(q => q.taught >= '2026-11-02').length).toBe(Math.min(6, week.length));
    expect(picked.some(q => q.taught < '2026-11-02')).toBe(true);
  }
  const questions = pool('3', FRIDAY);
  let seen: string[] = []; const played = new Set<string>(); let games = 0;
  for (;;) {
    const result = selectQuestions(questions, 10, seen, FRIDAY);
    if (games && result.seen.length === result.questions.length) break; // the bank ran out: a new cycle starts
    for (const q of result.questions) { expect(played.has(q.id)).toBe(false); played.add(q.id); }
    seen = result.seen; games++;
  }
  expect(games).toBeGreaterThan(5);
  expect(played.size).toBeGreaterThan(questions.length * .8);
});

test('Scoring rules: a second tap clears a mark, marks need Reveal, Back keeps marks, and ties are allowed', () => {
  const questions = pool('5', FRIDAY).slice(0, 2);
  let s = begin({ ...freshState(), asOf: FRIDAY, grade: '5', teamCount: 3, names: ['Eagles', ...Array(7).fill('')] }, questions, [], 'id', `${FRIDAY}T16:00:00.000Z`);
  expect(s.teams!.map(t => t.name)).toEqual(['Eagles', 'Purple', 'Green']);
  expect(toggleTeam(s, 'team-1')).toBe(s); // not revealed yet
  s = toggleTeam(toggleTeam(reveal(s), 'team-1'), 'team-2');
  s = toggleTeam(s, 'team-2');
  expect(scores(s).map(t => t.score)).toEqual([1, 0, 0]);
  s = next(s, `${FRIDAY}T16:01:00.000Z`);
  s = toggleTeam(reveal(s), 'team-2');
  expect(back(back(s)).index).toBe(0);
  expect(scores(back(back(s))).map(t => t.score)).toEqual([1, 1, 0]);
  expect(winners(s).map(t => t.name)).toEqual(['Eagles', 'Purple']);
  s = next(s, `${FRIDAY}T16:02:00.000Z`);
  expect(s.screen).toBe('complete');
  expect(isQuickState(s)).toBe(true);
  const session = toSession(s)!;
  expect(isGameSession(session)).toBe(true);
  expect(session).toMatchObject({ gameType: 'quick-check', grade: '5', mode: 'team' });
  expect(session.responses.filter(r => r.correct).map(r => r.teamId)).toEqual(['team-1', 'team-2']);
});

test('Team colors match the other games', () => {
  expect(quickTeamColors.slice(0, 6)).toEqual(teamColors);
  expect(quickTeamColors.map(c => c.accent)).toEqual(bingoColors.slice(0, 8));
});

test('Teams Off: grade then Start, one question at a time, Reveal then Next, Back, no scoring, saved to Session History', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Teams off' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Start →' })).toBeDisabled();
  await page.getByRole('button', { name: 'Grade 1', exact: true }).click();
  await page.getByRole('button', { name: 'Start →' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('1 of 5');
  const state = await saved(page);
  expect(state.questions.every(q => source.get(q.id)!.grade === '1' && q.taught <= FRIDAY)).toBe(true);
  await expect(page.locator('.qc-scorebar, .qc-mark')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '← Back' })).toBeDisabled();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('qc-progress')).toHaveText(`${i + 1} of 5`);
    await expect(page.locator('.qc-prompt h1')).toHaveText(state.questions[i].question);
    await expect(page.getByRole('button', { name: /^(Next →|Finish)$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    await expect(page.locator('.qc-game')).toContainText(state.questions[i].answer);
    await expect(page.locator('.qc-mark')).toHaveCount(0);
    if (i === 1) {
      // Back hides the answer, then returns to the previous question.
      await page.getByRole('button', { name: '← Back' }).click();
      await expect(page.getByRole('button', { name: 'Reveal', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '← Back' }).click();
      await expect(page.getByTestId('qc-progress')).toHaveText('1 of 5');
      await page.getByRole('button', { name: 'Next →' }).click();
      await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    }
    await page.getByRole('button', { name: i === 4 ? 'Finish' : 'Next →' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Nice work!' })).toBeVisible();
  await expect(page.locator('.qc-summary li')).toHaveCount(5);
  for (const q of state.questions) await expect(page.locator('.qc-summary')).toContainText(q.answer);
  await expect(page.locator('.qc-final, [data-testid=qc-winner]')).toHaveCount(0);
  const sessions = await history(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ gameType: 'quick-check', grade: '1', mode: 'classic', teams: [], responses: [] });
  expect(sessions[0].questions).toHaveLength(5);
  await page.reload();
  expect(await history(page)).toHaveLength(1); // a refresh never saves a second copy
  await page.getByRole('button', { name: 'Session History' }).click();
  await expect(page.getByRole('dialog')).toContainText('Quick Check');
});

test('Teams On: rename, tap correct teams after Reveal (second tap clears), score bar below the question, winner and scores saved', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Grade 4', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: '3 teams' }).click();
  await expect(page.getByLabel(/Name for team/)).toHaveCount(3);
  await page.getByLabel('Name for team 1').fill('Eagles');
  await page.getByRole('button', { name: 'Start →' }).click();
  await expect(page.getByTestId('qc-progress')).toHaveText('1 of 10');
  await expect(page.locator('.qc-scorebar')).toContainText('Eagles');
  await expect(page.locator('.qc-mark')).toHaveCount(0); // no marking before Reveal
  for (let i = 0; i < 10; i++) {
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
    if (i < 3) await mark.getByRole('button', { name: /Green/ }).click();
    await expect(page.getByTestId('qc-score-team-1')).toContainText(String(i + 1));
    await page.getByRole('button', { name: i === 9 ? 'Finish' : 'Next →' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Nice work!' })).toBeVisible();
  await expect(page.getByTestId('qc-winner')).toHaveText('Winner: Eagles');
  await expect(page.locator('.qc-final-scores')).toContainText('Eagles 10');
  await expect(page.locator('.qc-final-scores')).toContainText('Green 3');
  const [session] = await history(page);
  expect(session).toMatchObject({ gameType: 'quick-check', grade: '4', mode: 'team' });
  expect(session.teams.map((t: { name: string; accent: string }) => [t.name, t.accent])).toEqual([['Eagles', '#fb923c'], ['Purple', '#c084fc'], ['Green', '#4ade80']]);
  expect(session.responses).toHaveLength(30);
  expect(session.responses.filter((r: { teamId: string; correct: boolean }) => r.correct && r.teamId === 'team-1')).toHaveLength(10);
  expect(session.responses.filter((r: { teamId: string; correct: boolean }) => r.correct && r.teamId === 'team-3')).toHaveLength(3);
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
  await expect(page.locator('.qc-scorebar')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Next →' })).toBeInViewport({ ratio: 1 });
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
