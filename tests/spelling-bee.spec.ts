import { test, expect, type Page } from '@playwright/test';
import { ACTIVE_KEY, HISTORY_KEY, LISTS_KEY } from '../src/games/spelling-bee/storage';
import { beginGame, type BeeState } from '../src/games/spelling-bee/engine';
import { samples } from '../src/games/spelling-bee/words';
import type { Grade } from '../src/types';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };
const state = (page: Page): Promise<BeeState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), ACTIVE_KEY);
async function fits(page: Page) {
  expect(await page.evaluate(() => ({ height: document.documentElement.scrollHeight <= innerHeight, width: document.documentElement.scrollWidth <= innerWidth }))).toEqual({ height: true, width: true });
  const overflow = await page.locator('.bee-app button:visible, .bee-slots, .bee-clue, .bee-scoreboard, .bee-app h1').evaluateAll(nodes => nodes.filter(n => { const r = n.getBoundingClientRect(); return r.bottom > innerHeight || r.right > innerWidth || r.left < 0 || r.top < 0 || n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 2; }).map(n => n.textContent));
  expect(overflow).toEqual([]);
}
async function start(page: Page, grade = 'K') {
  await page.goto('/games/spelling-bee');
  const legacy = beginGame(samples.entries, grade as Grade, ['K','1','2'].includes(grade) ? 'supported' : 'missing', 'legacy-review', '2026-10-08T12:00:00Z', () => .99)!;
  await page.evaluate(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {key: ACTIVE_KEY, value: legacy});
  await page.reload(); await expect(page.getByRole('group', {name: 'Spelling letter slots'})).toBeVisible();
}
async function customSetup(page: Page) {
  await page.getByLabel('Content mode').selectOption('general');
  await page.getByLabel('Word bank').selectOption('custom');
}

for (const grade of ['K', '1', '2', '3', '4', '5']) test(`grade ${grade} legacy saved classroom flow, all words once, 1080p fit and saved summary`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/games/spelling-bee'); await fits(page);
  await start(page, grade);
  const original = await state(page); const seen: string[] = [];
  for (let i = 0; i < original.words.length; i++) {
    const current = await state(page); seen.push(current.words[current.index].word);
    await expect(page.getByRole('group', { name: 'Spelling letter slots', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next Word|Finish Game/ })).toBeDisabled();
    await fits(page);
    await expect(page.locator('.bee-play')).not.toContainText('One rider per team');
    if (await page.locator('.bee-challenge img').count()) await expect.poll(() => page.locator('.bee-challenge img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    if (['sit', 'map', 'ship', 'cake', 'rain', 'night'].includes(current.words[current.index].word)) await page.screenshot({ path: `test-results/spelling-bee-visual-${current.words[current.index].word}.png` });
    await endRound(page); await page.getByRole('button', { name: /^Orange:/ }).click();
    expect((await state(page)).session.responses).toHaveLength(i * 6);
    await endRound(page); await page.getByRole('button', { name: 'Commit Results', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Commit Results', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Orange:/ })).toContainText(String(i + 1));
    await page.getByRole('button', { name: 'Teacher: Reveal Answer', exact: true }).click();
    await expect(page.getByRole('group', { name: `Answer: ${current.words[current.index].word.toUpperCase().replace(/^NONFICTION$/, 'NON-FICTION')}`, exact: true })).toBeVisible();
    await fits(page);
    if (i === 0) { await page.screenshot({ path: `test-results/spelling-bee-grade-${grade}.png` }); await page.reload(); await expect(page.getByRole('button', { name: 'Commit Results', exact: true })).toBeDisabled(); }
    await page.getByRole('button', { name: i === original.words.length - 1 ? 'Finish Game' : 'Next Word', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Session Summary' })).toBeVisible(); await fits(page);
  expect(new Set(seen).size).toBe(original.words.length);
  await expect(page.getByTestId('bee-accuracy')).toHaveText('16.7% (5/30)');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await state(page)).screen).toBe('complete');
  await page.reload(); await expect(page.getByTestId('bee-accuracy')).toHaveText('16.7% (5/30)');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).states.length, HISTORY_KEY)).toBe(1);
  await page.screenshot({ path: `test-results/spelling-bee-summary-${grade}.png` });
  await page.getByRole('button', { name: 'New Game', exact: true }).click(); await page.reload();
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spelling Bee History' }).click(); await page.getByRole('button', { name: /Grade .*words/ }).click();
  await expect(page.getByTestId('bee-accuracy')).toHaveText('16.7% (5/30)'); expect(errors).toEqual([]);
});
test('custom lists: validate, save drafts, edit, approve, reuse, and handle empty grade', async ({ page }) => {
  await page.goto('/games/spelling-bee'); await customSetup(page); await fits(page);
  await page.getByLabel('Words', { exact: true }).fill('cat,CAT'); await expect(page.getByRole('alert')).toContainText('duplicate'); await expect(page.getByRole('button', { name: 'Save List' })).toBeDisabled();
  await page.getByLabel('Words', { exact: true }).fill('cat | A pet that says meow. | CVC | cat\nsun | It shines in the sky. | CVC | sun');
  await page.getByLabel('List name').fill('Scooter words'); await page.getByRole('button', { name: 'Save List' }).click();
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeDisabled();
  await page.reload(); await page.getByLabel('Content mode').selectOption('general'); await page.getByLabel('Word bank').selectOption({ label: 'Scooter words' }); await page.getByRole('button', { name: 'Edit a Copy' }).click();
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Save List' }).click();
  await page.getByLabel('Grade', { exact: true }).selectOption('5'); await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeDisabled();
  await page.getByLabel('Grade', { exact: true }).selectOption('K'); await page.getByLabel('Word bank').selectOption({ label: 'Scooter words (copy)' }); await page.getByLabel('Teacher approval').check(); await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  expect((await state(page)).words).toHaveLength(2);
  await endRound(page); await page.getByRole('button', { name: /^Orange:/ }).click(); await page.reload();
  await expect(page.getByRole('button', { name: /^Orange:/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear Selection' }).click(); await expect(page.getByRole('button', { name: /^Orange:/ })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'End Game', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Keep Playing' }).click();
  await page.getByRole('button', { name: 'End Game', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click();
  await expect(page.getByTestId('bee-accuracy')).toHaveText('—');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).lists.length, LISTS_KEY)).toBe(2);
});
test('continue, direct routing and browser Back preserve old games, timer, questions and assessment history', async ({ page }) => {
  await page.goto('/games/spelling-bee');
  await page.evaluate(records => Object.entries(records).forEach(([key, value]) => localStorage.setItem(key, value)), fixture.records);
  await page.getByLabel('Teacher approval').check(); await page.getByRole('button', { name: 'Start Game', exact: true }).click(); await endRound(page); await page.getByRole('button', { name: /^Blue:/ }).click();
  const draft = await state(page);
  await page.getByRole('button', { name: 'Games', exact: true }).click();
  await expect(page.getByRole('button', { name: /SPELLING BEE/ })).toContainText('CONTINUE'); await fits(page);
  await page.getByRole('button', { name: /SPELLING BEE/ }).click(); expect(await state(page)).toEqual(draft);
  await page.goBack(); await page.goForward(); expect(await state(page)).toEqual(draft);
  for (const [key, raw] of Object.entries(fixture.records)) expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
});
test('keyboard, touch targets, accessible hints and modal focus, mobile layout', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('heading', { name: /Spelling Bee · Word/ })).toBeFocused();
  await page.getByLabel('Letter hints').selectOption('challenge');
  await expect(page.getByRole('group', { name: 'Spelling letter slots' })).not.toContainText(/[A-Z]/);
  const small = await page.locator('.bee-play button').evaluateAll(nodes => nodes.filter(n => { const r = n.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(n => n.textContent)); expect(small).toEqual([]);
  await endRound(page); await page.getByRole('button', { name: /^Orange:/ }).focus(); await page.keyboard.press('Space'); await expect(page.getByRole('button', { name: /^Orange:/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'End Game', exact: true }).click(); await expect(page.getByRole('button', { name: 'Keep Playing' })).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Commit Results', exact: true })).toBeVisible();
});
test('bad saved state and unavailable writes display warnings and preserve data', async ({ page }) => {
  await page.goto('/games/spelling-bee'); await page.evaluate(key => localStorage.setItem(key, '{bad'), ACTIVE_KEY); await page.reload();
  await expect(page.getByRole('alert')).toContainText('left untouched'); await page.getByLabel('Teacher approval').check(); await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), ACTIVE_KEY)).toBe('{bad');
  await page.evaluate(key => localStorage.removeItem(key), ACTIVE_KEY); await page.reload();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await page.getByLabel('Teacher approval').check(); await page.getByRole('button', { name: 'Start Game', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Keep this tab open');
});
test('spoken clues and word audio are explicit teacher actions', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { (window as unknown as { spoken: string[] }).spoken = []; window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { (window as unknown as { spoken: string[] }).spoken.push(u.text); }; });
  const s = await state(page);
  await page.getByRole('button', { name: 'Speak Clue', exact: true }).click(); await page.getByRole('button', { name: 'Say Word', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual([s.words[0].clue, s.words[0].word]);
  expect((await state(page)).revealed).toBe(false);
});
test('missing image falls back to a clue and the next reviewed image still renders', async ({ page }) => {
  await page.route('**/spelling-bee/photos/cat.webp', route => route.abort());
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await start(page);
  await expect(page.getByRole('status').filter({ hasText: 'Picture unavailable' })).toBeVisible();
  await expect(page.locator('.bee-clue')).toContainText('meow');
  await endRound(page); await page.getByRole('button', { name: 'Commit Results', exact: true }).click(); await page.getByRole('button', { name: 'Next Word', exact: true }).click();
  await expect(page.locator('.bee-challenge img')).toBeVisible();
  await expect.poll(() => page.locator('.bee-challenge img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await fits(page);
});
test('maximum-length teacher word and clue fit the Smart Board with all scoring controls', async ({ page }) => {
  await page.goto('/games/spelling-bee'); await customSetup(page);
  await page.getByLabel('Grade', { exact: true }).selectOption('1'); await page.getByLabel('Words', { exact: true }).fill(`misunderstanding | ${'A careful teacher clue. '.repeat(7).trim()} | Prefix and suffix`);
  await page.getByRole('checkbox').check(); await fits(page);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click(); await fits(page);
  await page.getByRole('button', { name: 'Teacher: Reveal Answer', exact: true }).click(); await fits(page);
  await expect(page.getByRole('group', { name: 'Answer: MISUNDERSTANDING' })).toBeVisible();
});
test('long-word teacher hints survive refresh, respect the dropdown, and never reveal the full answer', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await start(page, '5');
  const slots = page.getByRole('group', { name: 'Spelling letter slots' });
  const texts = () => slots.locator('span').allTextContents();
  expect((await texts()).filter(c => c !== '_')).toHaveLength(3);
  expect((await texts()).join('')).toBe('PH___________S');
  await page.getByRole('button', { name: 'Reveal Another Letter', exact: true }).focus(); await page.keyboard.press('Enter');
  const hinted = await texts(); expect(hinted.filter(c => c !== '_')).toHaveLength(4);
  expect((await state(page)).session.responses).toHaveLength(0);
  await page.reload(); await expect(slots.locator('span')).toHaveText(hinted); await fits(page);
  await page.getByLabel('Letter hints').selectOption('challenge');
  expect((await texts()).filter(c => c !== '_')).toHaveLength(1);
  await page.getByLabel('Letter hints').selectOption('missing');
  while (await page.getByRole('button', { name: 'Reveal Another Letter', exact: true }).isEnabled()) await page.getByRole('button', { name: 'Reveal Another Letter', exact: true }).click();
  expect((await texts()).filter(c => c === '_')).toHaveLength(1); expect((await state(page)).revealed).toBe(false);
  await page.screenshot({ path: 'test-results/spelling-bee-incremental-hints.png' });
  await page.getByRole('button', { name: 'Teacher: Reveal Answer', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Answer: PHOTOSYNTHESIS' })).toBeVisible();
  await endRound(page); await page.getByRole('button', { name: /^Blue:/ }).click(); await endRound(page); await page.getByRole('button', { name: 'Commit Results', exact: true }).click();
  await page.getByRole('button', { name: 'Next Word', exact: true }).click();
  expect((await state(page)).extraLetters).toEqual([]);
  expect((await texts()).filter(c => c !== '_')).toHaveLength(2);
  await expect(page.getByRole('button', { name: /^Blue:/ })).toContainText('1');
});
test('new reviewed pictures can be paired with custom lists without adding images to sentence clues', async ({ page }) => {
  await page.goto('/games/spelling-bee'); await customSetup(page);
  await page.getByLabel('Grade', { exact: true }).selectOption('1'); await page.getByLabel('Words', { exact: true }).fill('ship | A large boat. | Digraph sh | ship');
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.locator('.bee-challenge img')).toHaveAttribute('src', '/spelling-bee/ship.svg');
  await expect(page.locator('.bee-challenge img')).toHaveAccessibleName(/large vessel/);
  await fits(page);
});

async function endRound(page: Page) { const button = page.getByRole('button', { name: 'Teacher: End Round Early', exact: true }); if (await button.count() && await button.isEnabled()) await button.click(); }
