import { test, expect, type Page } from '@playwright/test';
import { bank as cornerBank, beginGame, eligible, freshState as cornerFresh, STORAGE_KEY as CORNER_KEY, type CornerQuestion } from '../src/games/four-corners/engine';
import { containsWord, spokenTargetOk, SPOKEN_BANNER, SAY_WORD, SHOW_WORD, HIDE_WORD } from '../src/games/four-corners/spoken';
import { begin, freshState as quickFresh, isQuickState, pool, QUICK_CHECK_KEY } from '../src/games/quick-check/engine';
import { questionStatus, questionTaughtDate } from '../src/services/questionEngine';
import pacedCorners from '../src/data/paced-four-corners.json' with { type: 'json' };
import review from '../content/paced/2026-27-k-sight-words/review.json' with { type: 'json' };
import approvals from '../content/paced/2026-27-k-sight-words/approvals.json' with { type: 'json' };
import snapshot from '../content/sources/k-sight-words-2026-27.json' with { type: 'json' };

const SW = 'classthread-paced-2026-27-k-sight-words';
const FRIDAY = '2026-11-20';
const shipped = pacedCorners.filter(q => q.packId === SW) as unknown as CornerQuestion[];
const allTargets = [...new Set(shipped.map(q => q.spokenTarget!))];
// When each word is taught: the Monday of its row on the photographed list.
const taughtWeek = new Map(snapshot.content.split('\n').flatMap(line => { const [, week, words] = line.match(/^\[(\d{4}-\d\d-\d\d)\] (.*)$/)!; return words.split(', ').map(w => [w, week] as const); }));

/** Every visible text on the page except inside the given choice elements. */
const textOutside = (page: Page, choice: string) => page.evaluate(sel => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`${sel}, dialog:not([open]), script, style`).forEach(e => e.remove());
  document.body.append(clone); clone.style.position = 'absolute';
  const text = clone.innerText; clone.remove(); return text;
}, choice);
const printedTargets = (text: string) => allTargets.filter(w => containsWord(text, w));
async function speech(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = []; (window as unknown as { said: string[] }).said = said;
    class Utterance { text: string; lang = ''; rate = 1; constructor(t: string) { this.text = t; } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u: Utterance) => said.push(u.text), cancel: () => said.push('<cancel>') } });
  });
}
const said = (page: Page) => page.evaluate(() => (window as unknown as { said: string[] }).said.filter(s => s !== '<cancel>'));

test('Sight-word batch: 106 approved spoken rounds ship; the three with the word in the prompt are held', () => {
  expect(review).toHaveLength(109);
  expect(Object.values(approvals.decisions).every(d => d === 'approve')).toBe(true);
  expect(Object.keys(approvals.held).sort()).toEqual(['K-sw-1', 'K-sw-40', 'K-sw-5']);
  expect(shipped).toHaveLength(106);
  expect(review.some(r => r.id.includes('-dc-'))).toBe(false); // decoding items are left out for now
  const ids = shipped.map(q => q.batchItemId);
  for (const id of ['K-sw-1', 'K-sw-5', 'K-sw-40']) expect(ids).not.toContain(id);
  expect(new Set(shipped.map(q => q.id)).size).toBe(106);
  for (const q of shipped) {
    expect(cornerBank.some(c => c.id === q.id)).toBe(true); // the game accepts it
    expect([q.grade, q.subject, q.topic]).toEqual(['K', 'Literacy', 'sight-words']);
    expect(spokenTargetOk(q)).toBe(true);
    expect(q.answer).toBe(q.spokenTarget);
    expect(q.choices.filter(c => c === q.spokenTarget)).toHaveLength(1);
    for (const text of [q.question, SPOKEN_BANNER, SAY_WORD, SHOW_WORD, HIDE_WORD]) expect(containsWord(text, q.spokenTarget!)).toBe(false);
    // The word is taught that week; the other choices were taught on or before it.
    expect(taughtWeek.get(q.spokenTarget!)).toBe(q.weekIntroduced);
    for (const c of q.choices) expect(taughtWeek.get(c)! <= q.weekIntroduced).toBe(true);
    // Week-only evidence: hidden until the Friday of the week, then Current.
    const friday = questionTaughtDate(q)!;
    expect(new Date(`${friday}T12:00:00Z`).getUTCDay()).toBe(5);
    expect(questionStatus(q, new Date(Date.parse(friday) - 864e5).toISOString().slice(0, 10))).toBeNull();
    expect(questionStatus(q, friday)).toBe('current');
  }
  expect(new Set(shipped.map(q => q.correctIndex)).size).toBe(4);
  const nov20 = eligible('K', 'Reading / ELA', 'mixed', FRIDAY).filter(q => q.packId === SW);
  expect(nov20.map(q => q.spokenTarget)).toEqual(expect.arrayContaining(['which', 'their', 'said', 'if', 'do', 'will']));
  expect(nov20.some(q => q.weekIntroduced > '2026-11-16')).toBe(false);
});

test('spokenTarget rule: the word is the answer, appears once, and never in the question or the round’s labels', () => {
  const ok = { question: 'Listen! Run!', choices: ['in', 'is', 'it', 'you'], correctIndex: 1, spokenTarget: 'is' };
  expect(spokenTargetOk(ok)).toBe(true);
  expect(spokenTargetOk({ ...ok, spokenTarget: 'in' })).toBe(false); // not the answer
  expect(spokenTargetOk({ ...ok, choices: ['is', 'is', 'it', 'you'] })).toBe(false); // twice
  expect(spokenTargetOk({ ...ok, question: 'Run to the word is!' })).toBe(false); // printed in the question
  expect(spokenTargetOk({ ...ok, question: 'Run! IS it?' })).toBe(false); // any case
  expect(spokenTargetOk({ ...ok, question: 'This is it', spokenTarget: 'it', correctIndex: 2 })).toBe(false);
  expect(spokenTargetOk({ ...ok, question: 'This one', spokenTarget: 'is' })).toBe(true); // whole words only: "is" is not in "This"
  expect(spokenTargetOk({ question: 'Listen!', choices: ['the', 'a', 'to', 'of'], correctIndex: 0, spokenTarget: 'the' })).toBe(false); // in the banner
  expect(spokenTargetOk({ question: 'Listen!', choices: ['the', 'a', 'to', 'of'], correctIndex: 3, spokenTarget: 'of' })).toBe(true);
  // Quick Check refuses a saved spoken round that breaks the rule.
  const spoken = pool('K', FRIDAY).find(q => q.spokenTarget)!;
  const game = begin({ ...quickFresh(), asOf: FRIDAY, grade: 'K' }, [spoken], 'qc-spoken', `${FRIDAY}T16:00:00.000Z`);
  expect(isQuickState(game)).toBe(true);
  expect(isQuickState({ ...game, asked: [{ ...game.asked[0], question: `Run to ${spoken.spokenTarget}` }] })).toBe(false);
});

/** A Classic or Team game whose first two rounds are spoken sight words. */
function cornerGame(mode: 'classic' | 'team', teamCount = 6) {
  const available = eligible('K', 'Mixed Academic', 'mixed', FRIDAY);
  const spoken = available.filter(q => q.spokenTarget).slice(0, 2), rest = available.filter(q => !q.spokenTarget).slice(0, 8);
  const state = { ...cornerFresh(), grade: 'K' as const, rounds: 10 as const, mode, teamCount, movementDuration: 0 as const, content: 'mixed' as const, asOf: FRIDAY };
  return { spoken, state: beginGame(state, [...spoken, ...rest].map(q => q.id), 'fc-spoken', `${FRIDAY}T16:00:00.000Z`) };
}
async function openCorners(page: Page, state: object) {
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.goto('/games/four-corners');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [CORNER_KEY, JSON.stringify(state)]);
  await page.reload();
}

test('Four Corners spoken round: LISTEN banner, the word never printed outside the choices, Say the word, Show word hides on Next', async ({ page }) => {
  await speech(page);
  const { spoken, state } = cornerGame('classic');
  const [first, second] = spoken;
  await openCorners(page, state);
  await expect(page.locator('.fc-listen')).toHaveText(SPOKEN_BANNER);
  await expect(page.locator('.fc-prompt h1')).toHaveText(first.question);
  await expect(page.locator('.fc-choice span')).toHaveText(first.choices);
  // Before Reveal every corner looks the same and no shipped sight word is printed anywhere else.
  await expect(page.locator('.fc-correct, .fc-check, [data-testid=spoken-peek]')).toHaveCount(0);
  expect(new Set(await page.locator('.fc-choice').evaluateAll(els => els.map(e => e.className + getComputedStyle(e).backgroundColor + getComputedStyle(e).borderColor + getComputedStyle(e).fontSize))).size).toBe(1);
  expect(printedTargets(await textOutside(page, '.fc-choice'))).toEqual([]);

  await page.getByRole('button', { name: SAY_WORD }).click();
  expect(await said(page)).toEqual([first.spokenTarget]);
  await page.getByRole('button', { name: SHOW_WORD }).click();
  await expect(page.getByTestId('spoken-peek')).toHaveText(first.spokenTarget!);
  await page.getByRole('button', { name: HIDE_WORD }).click();
  await expect(page.getByTestId('spoken-peek')).toHaveCount(0);
  await page.getByRole('button', { name: SHOW_WORD }).click();

  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await expect(page.locator('.fc-choice').nth(first.correctIndex)).toHaveClass(/fc-correct/);
  await expect(page.locator('.fc-controls p')).toContainText(first.explanation!);
  await page.getByRole('button', { name: 'Next Question' }).click();
  // The next word starts hidden again.
  await expect(page.locator('.fc-choice span')).toHaveText(second.choices);
  await expect(page.getByTestId('spoken-peek')).toHaveCount(0);
  await expect(page.getByRole('button', { name: SHOW_WORD })).toHaveAttribute('aria-pressed', 'false');
  expect(printedTargets(await textOutside(page, '.fc-choice'))).toEqual([]);
  await page.getByRole('button', { name: SAY_WORD }).click();
  expect(await said(page)).toEqual([first.spokenTarget, second.spokenTarget]);
  // A refresh keeps the game and keeps the word hidden.
  await page.getByRole('button', { name: SHOW_WORD }).click();
  await page.reload();
  await expect(page.locator('.fc-choice span')).toHaveText(second.choices);
  await expect(page.getByTestId('spoken-peek')).toHaveCount(0);
  // Reports name the word that was said.
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), CORNER_KEY);
  expect(saved.session.questions[0].prompt).toContain(`“${first.spokenTarget}”`);
});

for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720]]) test(`Four Corners spoken round fits in Team Mode at ${width}×${height}, with nothing printed outside the choices`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await speech(page);
  const { state } = cornerGame('team', 12);
  await openCorners(page, state);
  await page.getByRole('button', { name: SHOW_WORD }).click();
  await page.getByRole('button', { name: HIDE_WORD }).click();
  expect(printedTargets(await textOutside(page, '.fc-choice'))).toEqual([]);
  for (const name of [SAY_WORD, HIDE_WORD.replace('Hide', 'Show'), 'Reveal Answer']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(height); expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.fc-game h1, .fc-choice, .fc-controls button').evaluateAll(els => els.every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && e.scrollHeight <= e.clientHeight + 1; }))).toBe(true);
});

test('Quick Check spoken round: LISTEN banner, Say the word instead of Read it to me, word hidden until Reveal, named in history', async ({ page }) => {
  await speech(page);
  const available = pool('K', FRIDAY), spoken = available.filter(q => q.spokenTarget);
  expect(spoken.length).toBeGreaterThan(40);
  expect(spoken.every(q => q.choices?.includes(q.spokenTarget!) && q.answer === q.spokenTarget)).toBe(true);
  const game = begin({ ...quickFresh(), asOf: FRIDAY, grade: 'K', teamCount: 2 }, spoken.slice(0, 2), 'qc-spoken', `${FRIDAY}T16:00:00.000Z`);
  const [first, second] = [game.asked[0], game.queue[0]]; // begin() shuffles the two
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.goto('/games/quick-check');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [QUICK_CHECK_KEY, JSON.stringify(game)]);
  await page.reload();
  await expect(page.locator('.qc-listen')).toHaveText(SPOKEN_BANNER);
  await expect(page.getByRole('button', { name: 'Read it to me' })).toHaveCount(0);
  await expect(page.locator('.qc-choice span')).toHaveText(first.choices!);
  await expect(page.locator('.qc-correct, .qc-answer-line')).toHaveCount(0);
  expect(printedTargets(await textOutside(page, '.qc-choice'))).toEqual([]);
  await page.getByRole('button', { name: SAY_WORD }).click();
  expect(await said(page)).toEqual([first.spokenTarget]);
  await page.getByRole('button', { name: SHOW_WORD }).click();
  await expect(page.getByTestId('spoken-peek')).toHaveText(first.spokenTarget!);
  await page.getByRole('button', { name: 'Reveal', exact: true }).click();
  await expect(page.locator('.qc-answer-line')).toContainText(first.spokenTarget!);
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.locator('.qc-choice span')).toHaveText(second.choices!);
  await expect(page.getByTestId('spoken-peek')).toHaveCount(0);
  await page.getByRole('button', { name: 'End', exact: true }).click();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.sessions.v1')!).sessions);
  expect(sessions[0].questions.map((q: { prompt: string }) => q.prompt)).toEqual([first, second].map(q => `${q.question} (Word: “${q.spokenTarget}”)`));
});
