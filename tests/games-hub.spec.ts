import { test, expect, type Page } from '@playwright/test';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };
import { gameForPath, LAST_OPENED_KEY, readLastOpened, recordOpened, spotlightGame } from '../src/games/lastOpened';

const memory = (value: string | null) => ({ getItem: () => value });

test('Last-opened record: only game routes count, and corrupt or unknown values are ignored', () => {
  expect(gameForPath('/games/spelling-bee')).toBe('spelling-bee');
  expect([gameForPath('/games'), gameForPath('/games/review'), gameForPath('/games/jeopardy/x')]).toEqual([null, null, null]);
  let written = '';
  recordOpened('four-corners', { setItem: (_key, value) => { written = value; } }, new Date('2026-10-26T15:00:00Z'));
  expect(JSON.parse(written)).toEqual({ version: 1, game: 'four-corners', at: '2026-10-26T15:00:00.000Z' });
  expect(readLastOpened(memory(written))).toBe('four-corners');
  for (const bad of [null, '{corrupt', '"jeopardy"', '{"version":2,"game":"jeopardy"}', '{"version":1,"game":"chess"}']) expect(readLastOpened(memory(bad))).toBeNull();
  expect(() => recordOpened('jeopardy', { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  expect(readLastOpened({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
});

test('Spotlight rule: the last-opened saved game, else the only saved game, else none', () => {
  expect(spotlightGame(['jeopardy', 'four-corners'], 'four-corners')).toBe('four-corners');
  expect(spotlightGame(['jeopardy', 'four-corners'], 'spelling-bee')).toBeNull();
  expect(spotlightGame(['jeopardy', 'four-corners'], null)).toBeNull();
  expect(spotlightGame(['state-lingo-bingo'], 'jeopardy')).toBe('state-lingo-bingo');
  expect(spotlightGame([], 'jeopardy')).toBeNull();
});

async function spotlights(page: Page) {
  await expect(page.locator('.game-card.live')).toHaveCount(4);
  return page.locator('.game-card.live').evaluateAll(cards => cards.map(card => ({
    name: card.querySelector('strong')!.textContent,
    tag: card.querySelector('.play-tag')!.textContent,
    spotlight: card.hasAttribute('data-spotlight'),
    tagBackground: getComputedStyle(card.querySelector('.play-tag')!).backgroundColor,
  })));
}

test('Games hub gives only the most recently opened saved game the orange CONTINUE spotlight', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, fixture.records);
  await page.reload();
  // The fixture saves Jeopardy and Four Corners; with no record of which was opened last, neither is the spotlight.
  let cards = await spotlights(page);
  expect(cards.map(c => [c.name, c.tag, c.spotlight])).toEqual([['JEOPARDY', 'CONTINUE ↗', false], ['FOUR CORNERS', 'CONTINUE ↗', false], ['SPELLING BEE', 'PLAY ↗', false], ['STATE LINGO BINGO', 'PLAY ↗', false]]);
  expect(new Set(cards.map(c => c.tagBackground))).toEqual(new Set(['rgba(0, 0, 0, 0)']));

  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, game: 'four-corners', at: '2026-10-26T15:00:00.000Z' })), LAST_OPENED_KEY);
  await page.reload();
  cards = await spotlights(page);
  expect(cards.filter(c => c.spotlight).map(c => c.name)).toEqual(['FOUR CORNERS']);
  expect(cards.find(c => c.name === 'FOUR CORNERS')!.tagBackground).toBe('rgb(255, 176, 32)');
  expect(cards.find(c => c.name === 'JEOPARDY')).toMatchObject({ tag: 'CONTINUE ↗', tagBackground: 'rgba(0, 0, 0, 0)' });

  // Opening Jeopardy from the hub moves the spotlight to it.
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page).toHaveURL(/\/games\/jeopardy$/);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game, LAST_OPENED_KEY)).toBe('jeopardy');
  await page.goto('/games');
  cards = await spotlights(page);
  expect(cards.filter(c => c.spotlight).map(c => c.name)).toEqual(['JEOPARDY']);
  expect(cards.find(c => c.name === 'FOUR CORNERS')).toMatchObject({ tag: 'CONTINUE ↗', spotlight: false });
});
