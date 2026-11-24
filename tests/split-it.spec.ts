import { test, expect, type Page } from '@playwright/test';
import {
  back, bank, begin, checkLines, checkVowels, current, end, freshState, isSplitState, keepGoing, lineRules, loadState, mondayOf, next, notes, orderQueue, pool,
  scores, showLines, showVowels, splitGrades, startOver, toggleLine, toggleVowel, toLines, toSession, toSetup, validWord, winners, wordFor, wordId,
  SPLIT_IT_KEY, type SplitState, type SplitWord,
} from '../src/games/split-it/engine';
import { isGameSession } from '../src/assessment/engine';
import rawBank from '../src/data/split-it-words.json' with { type: 'json' };
import pacedCorners from '../src/data/paced-four-corners.json' with { type: 'json' };

const FRIDAY = '2026-11-20';
const NOW = `${FRIDAY}T16:00:00.000Z`;
const HISTORY = 'curricuplay.sessions.v1';
const decoding = pacedCorners.filter(q => q.packId === 'classthread-paced-2026-27-decoding');
const fixedRandom = () => 0.3;
function days(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) out.push(d); return out; }
/** Solve the current word: right vowels, right lines (first try). */
function solve(s: SplitState): SplitState {
  const w = wordFor(current(s)!.id)!;
  for (const i of w.underline) s = toggleVowel(s, i);
  s = toLines(checkVowels(s));
  for (const k of w.splitAfterLetter) s = toggleLine(s, k);
  return checkLines(s);
}
const game = (grade: SplitState['grade'], teamCount = 0, asOf = FRIDAY) => begin({ ...freshState(), grade, teamCount, asOf }, pool(grade!, asOf), 'si-test', NOW, fixedRandom);

test('Word bank: 63 consistent words from the live decoding batch; every line follows the handout rule', () => {
  expect(bank).toHaveLength(63);
  expect(rawBank.words.every(validWord)).toBe(true);
  for (const w of bank) {
    // The word is in that grade's live decoding items, and unlocks on the day one of them is taught.
    const items = decoding.filter(q => q.grade === w.grade && new RegExp(`\\b${w.word}\\b`, 'i').test(`${q.question} ${q.choices.join(' ')}`));
    expect(items.length, w.word).toBeGreaterThan(0);
    expect(items.map(q => q.taughtOn), w.word).toContain(w.unlocks);
    // Each line: 1 consonant → before it; 2 → between; 3+ → between, not at either end; consonant + le → before it.
    const heard = w.underline.filter(i => !w.silentE.includes(i));
    for (const r of lineRules(w)) {
      const left = Math.max(...heard.filter(i => i < r.after)), right = Math.min(...heard.filter(i => i >= r.after));
      if (r.kind === 'one') expect(r.after, w.word).toBe(left + 1);
      if (r.kind === 'two') expect(r.after, w.word).toBe(left + 2);
      if (r.kind === 'more') { expect(r.after, w.word).toBeGreaterThan(left + 1); expect(r.after, w.word).toBeLessThan(right); }
      if (r.kind === 'consonant-le') expect(w.consonantLe.map(([a]) => a), w.word).toContain(r.after);
      expect(r.text.length).toBeGreaterThan(20);
    }
    expect(notes(w)[0]).toBe(`${w.splitAfterLetter.length + 1} vowel sounds, so ${w.splitAfterLetter.length + 1} syllables.`);
  }
  // Words left out of the bank on purpose stay out.
  for (const word of ['costume', 'basketball', 'celebrate']) expect(bank.some(w => w.word === word)).toBe(false);
  expect(notes(bank.find(w => w.word === 'cupcake')!)).toContain('Silent e: the e at the end makes no sound, so it gets no line before it.');
  expect(notes(bank.find(w => w.word === 'rainbow')!)).toEqual(expect.arrayContaining(['Vowel team “ai”: two letters, one sound. No line between them.', 'Vowel team “ow”: two letters, one sound. No line between them.']));
  expect(notes(bank.find(w => w.word === 'unhappy')!)).toContain('y at the end of a word is a vowel.');
  expect(lineRules(bank.find(w => w.word === 'complete')!)[0].text).toBe('3 consonants (m, p, l) between the vowels: the line goes between them, keeping “pl” together.');
  // A broken entry is refused, so the game never marks a right answer wrong.
  const napkin = bank.find(w => w.word === 'napkin')!;
  for (const broken of [{ underline: [1] }, { splitAfterLetter: [2] }, { split: 'na-pkin' }, { silentE: [0] }, { vowelTeams: [[1, 4]] }, { unlocks: 'soon' }])
    expect(validWord({ ...napkin, ...broken } as SplitWord)).toBe(false);
});

test('Pacing: never a word before its unlock date, every grade and school day; this week first, then review', () => {
  for (const grade of splitGrades) for (const day of days('2026-08-03', '2027-05-28')) {
    const words = pool(grade, day);
    expect(words.every(w => w.grade === grade && w.unlocks <= day)).toBe(true);
    expect(words.length).toBe(bank.filter(w => w.grade === grade && w.unlocks <= day).length);
  }
  expect(pool('1', '2026-11-12')).toHaveLength(0);
  expect(pool('1', '2026-11-13').map(w => w.word).sort()).toEqual(['cupcake', 'inside', 'kitten', 'magnet', 'picnic', 'sunshine']);
  const order = orderQueue(pool('1', FRIDAY), [], FRIDAY, fixedRandom).map(id => wordFor(id)!);
  const firstReview = order.findIndex(w => w.unlocks < mondayOf(FRIDAY));
  expect(firstReview).toBe(7); // the 7 words unlocked Nov 20, then the 6 from Nov 13
  expect(order.slice(firstReview).every(w => w.unlocks < mondayOf(FRIDAY))).toBe(true);
});

test('No repeats until the list runs out; starting over keeps the rest of the grade history', () => {
  let s = game('3');
  const ids = new Set<string>();
  while (!s.exhausted) { ids.add(current(s)!.id); s = next(solve(s)); }
  expect(ids.size).toBe(pool('3', FRIDAY).length);
  expect(s.seen['3']!.length).toBe(ids.size);
  // A new game finds nothing unused, so it starts the list over without a message.
  const again = begin(toSetup(end(s, NOW)), pool('3', FRIDAY), 'si-2', NOW, fixedRandom);
  expect(again.screen).toBe('play');
  const over = startOver(s, pool('3', FRIDAY), fixedRandom);
  expect(current(over)!.key).toBe(`${current(over)!.id}~2`);
  expect(over.pass).toBe(2);
  // Seen words from other dates survive (only this list is forgotten).
  const kept = startOver({ ...s, seen: { '3': [...s.seen['3']!, '3:future'] } }, pool('3', FRIDAY), fixedRandom);
  expect(kept.seen['3']).toContain('3:future');
});

test('Steps and scoring: taps only in their step, 1 point each for vowels and lines right on the first Check', () => {
  let s = game('2', 3);
  const w = wordFor(current(s)!.id)!;
  expect(toggleLine(s, 1)).toEqual(s); // no lines while finding vowels
  s = toggleVowel(s, w.underline[0]);
  s = checkVowels(s); // incomplete: wrong
  expect(current(s)).toMatchObject({ phase: 'vowels', vowelChecks: 1, vowelsFirst: false });
  for (const i of w.underline.slice(1)) s = toggleVowel(s, i);
  s = checkVowels(s); // now right, but not on the first Check
  expect(current(s)).toMatchObject({ phase: 'notes', vowelsFirst: false });
  expect(toggleVowel(s, 0)).toEqual(s); // vowels are locked after the check
  s = toLines(s);
  for (const k of w.splitAfterLetter) s = toggleLine(s, k);
  s = checkLines(s);
  expect(current(s)).toMatchObject({ phase: 'done', linesFirst: true });
  expect(scores(s).map(t => t.score)).toEqual([1, 0, 0]);
  // Back steps through the word without losing the result; Next returns to it.
  s = back(back(s));
  expect(current(s)!.phase).toBe('notes');
  expect(scores(s).map(t => t.score)).toEqual([1, 0, 0]);
  s = toLines(s); s = checkLines(s);
  expect(current(s)!.lineChecks).toBe(2); expect(current(s)!.linesFirst).toBe(true);
  // Teams take turns, one word each.
  s = next(s);
  expect(current(s)!.teamId).toBe('team-2');
  s = next(solve(s)); expect(current(s)!.teamId).toBe('team-3');
  s = next(solve(s)); expect(current(s)!.teamId).toBe('team-1');
  expect(scores(s).map(t => t.score)).toEqual([1, 2, 2]);
  expect(winners(s).map(t => t.name)).toEqual(['Purple', 'Green']);
  // Show me after a wrong Check fills in the answer for no point.
  s = checkVowels(s);
  expect(showVowels(game('2'))).toEqual(game('2')); // only after a wrong Check
  s = showVowels(s);
  expect(current(s)).toMatchObject({ phase: 'notes', vowelsShown: true, vowelsFirst: false });
  s = checkLines(toLines(s)); s = showLines(s);
  expect(current(s)).toMatchObject({ phase: 'done', linesShown: true, linesFirst: false });
  expect(scores(s).map(t => t.score)).toEqual([1, 2, 2]);
});

test('History: a vowels step and a lines step per word, credited to the team at the board; Teams Off records no responses', () => {
  let s = next(solve(game('4', 2)));
  s = checkVowels(s); // second word: vowels checked (wrong), lines never reached
  s = end(s, '2026-11-20T16:10:00.000Z');
  const session = toSession(s)!;
  expect(isGameSession(session)).toBe(true);
  expect(session).toMatchObject({ gameType: 'split-it', grade: '4', mode: 'team' });
  const first = s.asked[0], second = s.asked[1];
  expect(session.questions.map(q => q.questionId)).toEqual([`${first.key}:vowels`, `${first.key}:lines`, `${second.key}:vowels`]);
  expect(session.questions[1].prompt).toBe(`Split “${wordFor(first.id)!.word}” (${wordFor(first.id)!.split})`);
  expect(session.responses.map(r => [r.teamId, r.correct, r.pointsAwarded])).toEqual([['team-1', true, 1], ['team-1', true, 1], ['team-2', false, 0]]);
  expect(toSession(keepGoing(s))).toBeNull();
  const off = toSession(end(solve(game('4')), NOW))!;
  expect(off.mode).toBe('classic'); expect(off.responses).toEqual([]); expect(off.questions).toHaveLength(2);
});

test('Saves: a game in progress validates; invalid saves open a fresh setup; setup keeps the choices', () => {
  const s = toggleVowel(game('1', 2), 1);
  expect(isSplitState(s)).toBe(true);
  const store = (v: unknown) => ({ getItem: () => JSON.stringify(v) });
  expect(loadState(store(s))).toEqual(s);
  for (const bad of [{ ...s, grade: 'K' }, { ...s, movement: 12 }, { ...s, teamCount: 9 }, { ...s, asked: [{ ...s.asked[0], id: '1:nope' }] },
    { ...s, asked: [{ ...s.asked[0], phase: 'done' }] }, { ...s, asked: [{ ...s.asked[0], vowelsFirst: true }] }, { ...s, asked: [{ ...s.asked[0], teamId: 'team-9' }] }])
    expect(loadState(store(bad)).screen).toBe('setup');
  expect(loadState({ getItem: () => '{broken' }).screen).toBe('setup');
  const setup = toSetup({ ...s, movement: 15 });
  expect(setup).toMatchObject({ screen: 'setup', grade: '1', teamCount: 2, movement: 15, seen: s.seen });
});

// ---- Browser ----
async function open(page: Page, state?: SplitState) {
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.addInitScript(() => {
    const said: string[] = []; (window as unknown as { said: string[] }).said = said;
    class Utterance { text: string; lang = ''; rate = 1; constructor(t: string) { this.text = t; } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u: Utterance) => said.push(u.text), cancel: () => undefined } });
  });
  await page.goto('/games/split-it');
  if (state) { await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SPLIT_IT_KEY, JSON.stringify(state)]); await page.reload(); }
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SPLIT_IT_KEY) as Promise<SplitState>;
const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);

test('Teams Off: grade then Start; underline, check, notes, draw lines, check, rule, Speak; Back, End, Keep going, history', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Grade 1', exact: true }).click();
  await expect(page.getByText('7 this week, then 6 review · keeps going until you tap End')).toBeVisible();
  await page.getByRole('button', { name: 'Start →' }).click();
  let s = await saved(page);
  const w = wordFor(current(s)!.id)!;
  await expect(page.getByTestId('si-progress')).toHaveText('Word 1');
  await expect(page.locator('.si-tile')).toHaveText([...w.word]);
  await expect(page.getByText('STEP 1 · UNDERLINE EVERY VOWEL')).toBeVisible();
  // A wrong Check, then the right vowels.
  await page.getByRole('button', { name: 'Check vowels' }).click();
  await expect(page.getByText(/^Not yet\. Look again/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me' })).toBeVisible();
  for (const i of w.underline) await page.getByRole('button', { name: `Letter ${i + 1}: ${w.word[i]}`, exact: true }).click();
  await page.reload(); // a refresh keeps the taps
  for (const i of w.underline) await expect(page.getByRole('button', { name: `Letter ${i + 1}: ${w.word[i]}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Check vowels' }).click();
  await expect(page.getByText('STEP 2 · VOWEL NOTES')).toBeVisible();
  for (const n of notes(w)) await expect(page.getByText(n, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Draw lines →' }).click();
  for (const k of w.splitAfterLetter) await page.getByRole('button', { name: new RegExp(`^Gap ${k}:`) }).click();
  await page.getByRole('button', { name: 'Check lines' }).click();
  await expect(page.getByText('STEP 4 · SAY IT')).toBeVisible();
  for (const r of lineRules(w)) await expect(page.getByText(r.text, { exact: true })).toBeVisible();
  await expect(page.getByTestId('si-syllables')).toHaveText(w.split.split('-').join(' · '));
  await page.getByRole('button', { name: 'Speak', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { said: string[] }).said)).toEqual([...w.split.split('-'), w.word]);
  expect(await fits(page)).toBe(true);
  await page.getByRole('button', { name: 'Next word →' }).click();
  await expect(page.getByTestId('si-progress')).toHaveText('Word 2');
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByTestId('si-progress')).toHaveText('Word 1');
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nice splitting!' })).toBeVisible();
  await expect(page.locator('.si-summary li')).toHaveCount(2);
  await expect(page.locator('.si-summary li').first()).toContainText(w.split);
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByTestId('si-progress')).toHaveText('Word 1');
  await page.getByRole('button', { name: 'End', exact: true }).click();
  s = await saved(page);
  const sessions = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions, HISTORY);
  expect(sessions.filter((x: { id: string }) => x.id === s.sessionId)).toHaveLength(1); // ending twice replaced the record
  expect(sessions[0]).toMatchObject({ gameType: 'split-it', grade: '1', mode: 'classic' });
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Session History' }).click();
  await expect(page.getByRole('dialog')).toContainText('Split It!');
});

test('Teams On: the team at the board earns the points; score bar; end screen names the winner', async ({ page }) => {
  let s = solve(game('5', 2));
  await open(page, s);
  await expect(page.getByTestId('si-turn')).toContainText('Orange');
  await expect(page.getByText('Vowels: ✓ first try · +1 Orange')).toBeVisible();
  await expect(page.getByTestId('si-score-team-1')).toHaveText('Orange 2');
  await page.getByRole('button', { name: 'Next word →' }).click();
  await expect(page.getByTestId('si-turn')).toContainText('Purple');
  s = await saved(page);
  const w = wordFor(current(s)!.id)!;
  await page.getByRole('button', { name: 'Check vowels' }).click(); // wrong first try
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.getByText('Vowels: no point this time')).toBeVisible();
  await page.getByRole('button', { name: 'Draw lines →' }).click();
  for (const k of w.splitAfterLetter) await page.getByRole('button', { name: new RegExp(`^Gap ${k}:`) }).click();
  await page.getByRole('button', { name: 'Check lines' }).click();
  await expect(page.getByTestId('si-score-team-2')).toHaveText('Purple 1');
  expect(await fits(page)).toBe(true);
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByTestId('si-winner')).toHaveText('Winner: Orange');
});

test('Movement: no timer when Off; when On, a 15 s exercise timer the teacher starts, which never moves the game on', async ({ page }) => {
  await open(page, game('3'));
  await expect(page.getByRole('region', { name: 'Exercise timer' })).toHaveCount(0);
  await page.clock.install({ time: new Date(`${FRIDAY}T12:00:00-05:00`) });
  await open(page, { ...game('3'), movement: 15 });
  const timer = page.getByRole('region', { name: 'Exercise timer' });
  await expect(timer).toContainText('EXERCISE TIMER');
  const before = await saved(page);
  await page.getByRole('button', { name: 'Start 15 s' }).click();
  await page.clock.runFor(5000);
  await expect(page.getByRole('timer', { name: 'Exercise countdown' })).toHaveText('10');
  await page.clock.runFor(11000);
  await expect(timer).toContainText('TIME!');
  expect(await saved(page)).toEqual(before);
});

for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720]]) test(`Fits one screen at ${width}×${height}: setup with 8 teams and Movement On, and the longest word in every step`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await open(page);
  await page.getByRole('button', { name: 'Grade 5', exact: true }).click();
  await page.getByRole('button', { name: '8 teams' }).click();
  await page.getByRole('button', { name: 'Movement on' }).click();
  await page.getByRole('button', { name: 'Exercise 20 seconds' }).click();
  expect(await fits(page)).toBe(true);
  // "independent": 11 letters, 3 lines, with 8 teams and the timer.
  const word = bank.find(w => w.word === 'independent')!;
  const base = begin({ ...freshState(), grade: '5', teamCount: 8, movement: 20, asOf: FRIDAY }, [word], 'si-fit', NOW);
  await open(page, base);
  const tiles = page.locator('.si-tile');
  await expect(tiles).toHaveCount(11);
  for (const step of ['vowels', 'notes', 'lines', 'done']) {
    expect(await fits(page), step).toBe(true);
    const boxes = await page.locator('.si-tile, button.si-gap, .si-controls button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, r.width, r.height, e.className]; }));
    for (const [l, r, t, b] of boxes) expect(l >= 0 && r <= width && t >= 0 && b <= height, step).toBe(true);
    if (step === 'lines') for (const [, , , , w, h] of boxes.filter(b => String(b[6]).includes('si-gap'))) { expect(w).toBeGreaterThanOrEqual(48); expect(h).toBeGreaterThanOrEqual(48); }
    if (step === 'vowels') {
      const [, , , , w, h] = boxes[0];
      expect(Math.min(w as number, h as number)).toBeGreaterThanOrEqual(48);
      for (const i of word.underline) await page.getByRole('button', { name: `Letter ${i + 1}: ${word.word[i]}`, exact: true }).click();
      await page.getByRole('button', { name: 'Check vowels' }).click();
    }
    if (step === 'notes') await page.getByRole('button', { name: 'Draw lines →' }).click();
    if (step === 'lines') { for (const k of word.splitAfterLetter) await page.getByRole('button', { name: new RegExp(`^Gap ${k}:`) }).click(); await page.getByRole('button', { name: 'Check lines' }).click(); }
  }
  // Letters are large on the board: at 1920×1080 the 11-letter word's letters are at least 80px.
  if (width === 1920) expect(await tiles.first().evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(80);
});

test('Hub: Split It! card opens the game, then shows CONTINUE with the grade and word', async ({ page }) => {
  await open(page);
  await page.goto('/games');
  const card = page.getByRole('button', { name: /SPLIT IT!/ });
  await expect(card).toContainText('Find the vowels. Split the word.');
  await card.click();
  await expect(page).toHaveURL(/\/games\/split-it$/);
  await page.getByRole('button', { name: 'Grade 2', exact: true }).click();
  await page.getByRole('button', { name: 'Start →' }).click();
  await page.goto('/games');
  await expect(card).toContainText('Grade 2 · Word 1');
  await expect(card.locator('.play-tag')).toHaveText('CONTINUE ↗');
});
