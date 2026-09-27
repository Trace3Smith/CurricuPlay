import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };

// Games remain usable independently of account/provider configuration.
test('Games landing, dedicated routes, browser Back, and original hash bookmarks recover correctly', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByRole('button', { name: /JEOPARDY/ })).toBeVisible();
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, fixture.records);
  await page.reload();
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page).toHaveURL(/\/games\/jeopardy$/);
  await expect(page.getByRole('button', { name: 'Back to Board' })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('curricuplay.game.v1'));
  await page.goBack();
  await expect(page.getByRole('button', { name: /FOUR CORNERS/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.game.v1'))).toBe(saved);
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Back to Board' })).toBeVisible();
  await page.goto('/#four-corners');
  await expect(page).toHaveURL(/\/games\/four-corners$/);
  await expect(page.getByText('Round 2 of 10', { exact: true })).toBeVisible();
  await page.goto('/#review');
  await expect(page).toHaveURL(/\/games\/review$/);
  await expect(page.getByRole('heading', { name: 'Question Review', exact: true })).toBeVisible();
});

test('Versioned browser export downloads raw Games records with checksums and excludes unrelated storage', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); localStorage.setItem('unrelated-credential', 'never-export-me'); }, fixture.records);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Export browser Games data' })).toBeVisible();
  const raw = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(fixture.records));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export browser Games data' }).click()]);
  const text = await readFile((await download.path())!, 'utf8');
  const archive = JSON.parse(text);
  expect(archive.format).toBe('classthread-browser-archive'); expect(archive.version).toBe(1);
  expect(archive.records).toEqual(raw);
  for (const [key, value] of Object.entries(raw)) expect(archive.checksums[key]).toBe(value === null ? null : createHash('sha256').update(value).digest('hex'));
  expect(text).not.toContain('never-export-me');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('classthread.legacy-backup.v1')!).records)).toEqual(fixture.records);
});

for (const mode of ['team', 'classic', 'legacy-classic'] as const) test(`Games card continues a recoverable ${mode} session without changing browser records`, async ({ page }) => {
  await page.goto('/games');
  const corners = page.getByRole('button', { name: /FOUR CORNERS/ });
  const jeopardy = page.getByRole('button', { name: /JEOPARDY/ });
  await expect(corners.locator('.play-tag')).toHaveText('PLAY ↗');
  await expect(jeopardy.locator('.play-tag')).toHaveText('PLAY ↗');
  const active = JSON.parse(fixture.records['curricuplay.four-corners.v1']);
  if (mode !== 'team') {
    active.mode = 'classic'; active.correctTeamIds = [];
    active.session.mode = 'classic'; active.session.teams = []; active.session.responses = [];
    if (mode === 'legacy-classic') { delete active.mode; delete active.session; delete active.correctTeamIds; delete active.teamCount; }
  }
  const records = { ...fixture.records, 'curricuplay.four-corners.v1': JSON.stringify(active) };
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, records);
  await page.reload();
  await expect(corners.locator('.play-tag')).toHaveText('CONTINUE ↗');
  await expect(corners.locator('.card-description')).toHaveText(`Kindergarten · ${mode === 'team' ? 'Team Mode' : 'Classic'}`);
  await expect(jeopardy.locator('.play-tag')).toHaveText('CONTINUE ↗');
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(records))).toEqual(records);
  expect(await page.locator('.game-card.live').evaluateAll(cards => cards.every(card => {
    const bounds = card.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth && card.scrollHeight <= card.clientHeight + 1;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (mode === 'team') await page.screenshot({ path: 'test-results/games-continue-1920.png' });
  await corners.click();
  await expect(page.getByText('Round 2 of 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(corners.locator('.play-tag')).toHaveText('CONTINUE ↗');
  await expect(jeopardy.locator('.play-tag')).toHaveText('CONTINUE ↗');
});

test('Games card offers Play for inactive, invalid, withdrawn, or inaccessible Four Corners saves without rewriting them', async ({ page }) => {
  await page.goto('/games');
  const active = JSON.parse(fixture.records['curricuplay.four-corners.v1']);
  const complete = { ...active, screen: 'complete', endedEarly: true, correctTeamIds: [], session: { ...active.session, endedAt: '2026-09-26T16:30:00.000Z' } };
  for (const raw of [null, '{broken', JSON.stringify({ ...active, screen: 'setup' }), JSON.stringify(complete), JSON.stringify({ ...active, questionIds: ['unavailable-question'] }), JSON.stringify({ ...active, correctTeamIds: ['unknown-team'] })]) {
    await page.evaluate(raw => { if (raw === null) localStorage.removeItem('curricuplay.four-corners.v1'); else localStorage.setItem('curricuplay.four-corners.v1', raw); }, raw);
    await page.reload();
    await expect(page.getByRole('button', { name: /FOUR CORNERS/ }).locator('.play-tag')).toHaveText('PLAY ↗');
    expect(await page.evaluate(() => localStorage.getItem('curricuplay.four-corners.v1'))).toBe(raw);
  }
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, fixture.records);
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the unchanged production recovery and review modules.
    const engine = await import('/src/games/four-corners/engine.ts');
    // @ts-expect-error Vite module.
    const review = await import('/src/services/questionReview.ts');
    const saved = JSON.parse(localStorage.getItem(engine.STORAGE_KEY)!);
    const question = engine.bank.find((question: { id: string }) => question.id === saved.questionIds[0]);
    review.writeReview(question, 'rejected', question.question, question.answer);
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /FOUR CORNERS/ }).locator('.play-tag')).toHaveText('PLAY ↗');
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.four-corners.v1'))).toBe(fixture.records['curricuplay.four-corners.v1']);
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if (key === 'curricuplay.four-corners.v1') throw new Error('Storage unavailable'); return getItem.call(this, key); };
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /FOUR CORNERS/ }).locator('.play-tag')).toHaveText('PLAY ↗');
});

test('Four Corners card updates after starting and ending a game during the same visit', async ({ page }) => {
  await page.goto('/games');
  const corners = page.getByRole('button', { name: /FOUR CORNERS/ });
  await expect(corners.locator('.play-tag')).toHaveText('PLAY ↗');
  await corners.click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(corners.locator('.play-tag')).toHaveText('CONTINUE ↗');
  await corners.click();
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session Report', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(corners.locator('.play-tag')).toHaveText('PLAY ↗');
  await expect(page.getByRole('button', { name: /JEOPARDY/ }).locator('.play-tag')).toHaveText('PLAY ↗');
});
