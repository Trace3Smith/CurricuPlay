import { test, expect, type Page } from '@playwright/test';
import {
  back, bank, begin, checkLines, checkVowels, current, end, freshState, isSplitState, keepGoing, lineRules, loadState, mondayOf, next, notes, orderQueue, pool,
  scores, showLines, showVowels, splitGrades, startOver, toggleLine, toggleVowel, toLines, toSession, toSetup, validWord, winners, wordFor, wordId, marking, wrongCheck,
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

test('Teams on: each step gets one try; a wrong try is marked and the game moves on, 0 points, no Show me', () => {
  let s = game('2', 3);
  const w = wordFor(current(s)!.id)!;
  expect(toggleLine(s, 1)).toEqual(s); // no lines while finding vowels
  const wrongLetter = [...w.word].findIndex((_, i) => !w.underline.includes(i));
  s = toggleVowel(toggleVowel(s, w.underline[0]), wrongLetter); // one right, one wrong, the rest missed
  s = checkVowels(s);
  expect(current(s)).toMatchObject({ phase: 'notes', vowelChecks: 1, vowelsFirst: false });
  expect(marking(current(s)!, w)).toMatchObject({ wrongLetters: [wrongLetter], missedVowels: w.underline.slice(1) });
  expect(wrongCheck(current(s)!)).toBe(false); // no "Not yet" and no Show me
  expect(showVowels(s)).toEqual(s);
  expect(checkVowels(s)).toEqual(s); expect(toggleVowel(s, 0)).toEqual(s); // locked after the one try
  // Back never reopens a checked step: lines (unchecked) back to the notes, otherwise the previous word.
  s = toLines(s);
  expect(current(back(s))!.phase).toBe('notes');
  const wrongGap = [1, 2, 3].find(k => !w.splitAfterLetter.includes(k))!;
  s = checkLines(toggleLine(s, wrongGap));
  expect(current(s)).toMatchObject({ phase: 'done', lineChecks: 1, linesFirst: false });
  expect(marking(current(s)!, w)).toMatchObject({ wrongLines: [wrongGap], missedLines: w.splitAfterLetter });
  expect(back(s)).toEqual(s); // first word: nothing earlier, and its checks stay closed
  expect(scores(s).map(t => t.score)).toEqual([0, 0, 0]);
  // Right on the one try: 1 point each; teams take turns, one word each.
  s = next(s); expect(current(s)!.teamId).toBe('team-2');
  s = solve(s); expect(scores(s).map(t => t.score)).toEqual([0, 2, 0]);
  expect(marking(current(s)!, wordFor(current(s)!.id)!)).toEqual({ wrongLetters: [], missedVowels: [], wrongLines: [], missedLines: [] });
  s = next(s); expect(current(s)!.teamId).toBe('team-3');
  s = back(s); expect(current(s)!.teamId).toBe('team-2'); // previous word, results kept
  s = next(next(s)); expect(current(s)!.teamId).toBe('team-3');
  s = next(solve(s)); expect(current(s)!.teamId).toBe('team-1');
  expect(scores(s).map(t => t.score)).toEqual([0, 2, 2]);
  expect(winners(s).map(t => t.name)).toEqual(['Purple', 'Green']);
});

test('Teams Off (class practice): "Not yet" keeps the step open for another try, and Show me fills in the answer', () => {
  let s = game('2');
  const w = wordFor(current(s)!.id)!;
  s = checkVowels(toggleVowel(s, w.underline[0]));
  expect(current(s)).toMatchObject({ phase: 'vowels', vowelChecks: 1, vowelsFirst: false });
  expect(wrongCheck(current(s)!)).toBe(true);
  expect(marking(current(s)!, w).wrongLetters).toEqual([]); // no team marking in practice
  for (const i of w.underline.slice(1)) s = toggleVowel(s, i);
  s = checkVowels(s);
  expect(current(s)).toMatchObject({ phase: 'notes', vowelChecks: 2 });
  s = checkLines(toLines(s));
  expect(current(s)!.phase).toBe('lines');
  expect(showVowels(game('2'))).toEqual(game('2')); // Show me only after a wrong Check
  s = showLines(s);
  expect(current(s)).toMatchObject({ phase: 'done', linesShown: true, linesFirst: false });
  // Back steps through the word's steps.
  expect(current(back(s))!.phase).toBe('lines');
  expect(current(back(back(back(s))))!.phase).toBe('vowels');
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

test('Teams On: one try per step; a wrong try is marked red/green at once with 0 points and no Show me; winner named', async ({ page }) => {
  let s = solve(game('5', 2));
  await open(page, s);
  await expect(page.getByTestId('si-turn')).toContainText('Orange');
  await expect(page.getByText('Vowels: ✓ right · +1 Orange')).toBeVisible();
  await expect(page.getByTestId('si-score-team-1')).toHaveText('Orange 2');
  await page.getByRole('button', { name: 'Next word →' }).click();
  await expect(page.getByTestId('si-turn')).toContainText('Purple');
  s = await saved(page);
  const w = wordFor(current(s)!.id)!;
  // Vowels: one right, one wrong letter, the rest missed. One Check marks it and moves straight on to the notes.
  const wrongLetter = [...w.word].findIndex((_, i) => !w.underline.includes(i));
  await page.getByRole('button', { name: `Letter ${w.underline[0] + 1}: ${w.word[w.underline[0]]}`, exact: true }).click();
  await page.getByRole('button', { name: `Letter ${wrongLetter + 1}: ${w.word[wrongLetter]}`, exact: true }).click();
  await page.getByRole('button', { name: 'Check vowels' }).click();
  await expect(page.getByText('STEP 2 · VOWEL NOTES')).toBeVisible();
  await expect(page.getByTestId('si-marked')).toHaveText('Not right, 0 points. ✗ red: not a vowel. + green: a vowel that was missed.');
  await expect(page.locator('.si-tile.si-wrong')).toHaveCount(1);
  await expect(page.locator(`.si-tile[data-letter="${wrongLetter}"]`)).toHaveClass(/si-wrong/);
  await expect(page.locator(`.si-tile[data-letter="${wrongLetter}"] .si-badge`)).toHaveText('✗');
  await expect(page.locator('.si-tile.si-missed')).toHaveCount(w.underline.length - 1);
  await expect(page.locator(`.si-tile[data-letter="${w.underline[0]}"]`)).toHaveClass(/si-underlined/);
  expect(await page.locator('.si-tile.si-wrong').evaluate(e => getComputedStyle(e).borderColor)).toBe('rgb(179, 38, 30)');
  expect(await page.locator('.si-tile.si-missed').first().evaluate(e => getComputedStyle(e).borderColor)).toBe('rgb(61, 181, 74)');
  await expect(page.getByText('Vowels: ✗ not right · 0 points')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0);
  await expect(page.getByText(/^Not yet/)).toHaveCount(0);
  for (const n of notes(w)) await expect(page.getByText(n, { exact: true })).toBeVisible();
  // A refresh keeps the marking.
  await page.reload();
  await expect(page.locator('.si-tile.si-wrong')).toHaveCount(1);
  // Lines: one wrong gap. One Check marks the wrong line red and the right lines green, then Say it.
  await page.getByRole('button', { name: 'Draw lines →' }).click();
  const wrongGap = [1, 2, 3].find(k => !w.splitAfterLetter.includes(k))!;
  await page.getByRole('button', { name: new RegExp(`^Gap ${wrongGap}:`) }).click();
  await page.getByRole('button', { name: 'Check lines' }).click();
  await expect(page.getByText('STEP 4 · SAY IT')).toBeVisible();
  await expect(page.getByTestId('si-marked')).toHaveText('Not right, 0 points. ✗ red: the wrong place. + green: where the line goes.');
  await expect(page.locator(`.si-gap[data-gap="${wrongGap}"]`)).toHaveClass(/si-line-wrong/);
  for (const k of w.splitAfterLetter) await expect(page.locator(`.si-gap[data-gap="${k}"]`)).toHaveClass(/si-line-missed/);
  await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0);
  for (const r of lineRules(w)) await expect(page.getByText(r.text, { exact: true })).toBeVisible();
  await expect(page.getByTestId('si-score-team-2')).toHaveText('Purple 0');
  expect(await fits(page)).toBe(true);
  // Back goes to the previous word; it never reopens Purple's checked steps.
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByTestId('si-turn')).toContainText('Orange');
  await page.getByRole('button', { name: 'Next word →' }).click();
  await expect(page.getByText('STEP 4 · SAY IT')).toBeVisible();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByTestId('si-winner')).toHaveText('Winner: Orange');
});

test('Teams Off keeps practice mode: "Not yet", another try, and Show me', async ({ page }) => {
  const s = game('5');
  await open(page, s);
  await page.getByRole('button', { name: 'Check vowels' }).click();
  await expect(page.getByText(/^Not yet\. Look again/)).toBeVisible();
  await expect(page.getByText('STEP 1 · UNDERLINE EVERY VOWEL')).toBeVisible();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.getByText('STEP 2 · VOWEL NOTES')).toBeVisible();
  await expect(page.locator('.si-wrong, .si-missed, [data-testid=si-marked]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Draw lines →' }).click();
  await page.getByRole('button', { name: 'Check lines' }).click();
  await expect(page.getByText(/^Not yet\. Count the consonants/)).toBeVisible();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.getByText('STEP 4 · SAY IT')).toBeVisible();
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
