import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };
import { backupKey, captureBrowserExport, captureBrowserState, exportKeys, legacyKeys, preserveBrowserState, withChecksums } from '../src/integrations/legacy-storage/preservation';
import { ACTIVE_KEY, HISTORY_KEY, LISTS_KEY } from '../src/games/spelling-bee/storage';
import { BINGO_ACTIVE_KEY } from '../src/games/state-lingo-bingo/keys';
import { beginGame } from '../src/games/spelling-bee/engine';
import { samples } from '../src/games/spelling-bee/words';
import { isGameSession, summarizeSession } from '../src/assessment/engine';

const sha256 = (value: string | null) => value === null ? null : createHash('sha256').update(value).digest('hex');
const bee = {
  [ACTIVE_KEY]: JSON.stringify(beginGame(samples.entries, '2', 'supported', 'backup-test', '2026-10-08T12:00:00Z', () => .5)),
  [LISTS_KEY]: JSON.stringify({ version: 1, lists: [{ id: 'list-1', name: 'Week 6', entries: samples.entries }] }),
  [HISTORY_KEY]: '{corrupt spelling history',
};

function storage(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test('Legacy preservation keeps exact raw values, including corrupt data, without capturing credentials', () => {
  const original = { ...fixture.records, 'curricuplay.game.v1': '{corrupt but recoverable', 'auth-token': 'never export' };
  const store = storage(original);
  const result = preserveBrowserState(store, 'https://example.test');
  expect(result.warning).toBe('');
  expect(Object.keys(result.archive!.records)).toEqual([...legacyKeys]);
  expect(result.archive!.records['curricuplay.game.v1']).toBe(original['curricuplay.game.v1']);
  for (const key of legacyKeys) expect(store.getItem(key)).toBe(original[key]);
  expect(JSON.stringify(result.archive)).not.toContain('never export');
  const first = store.getItem(backupKey);
  store.setItem('curricuplay.game.v1', 'new state');
  preserveBrowserState(store, 'https://example.test');
  expect(store.getItem(backupKey)).toBe(first);
});

test('Empty storage is not claimed and failed backup writes retain an in-memory export', () => {
  const empty = storage();
  preserveBrowserState(empty, 'https://example.test');
  expect(empty.getItem(backupKey)).toBeNull();
  const store = storage(fixture.records);
  const result = preserveBrowserState({ ...store, setItem: () => { throw new Error('quota'); } }, 'https://example.test');
  expect(result.warning).toContain('Download');
  expect(result.archive!.records).toEqual(fixture.records);
  expect(captureBrowserState(store, 'https://example.test').records).toEqual(fixture.records);
});

test('Versioned compatibility fixture preserves scored history independently of current question banks', () => {
  const history = JSON.parse(fixture.records['curricuplay.sessions.v1']);
  expect(isGameSession(history.sessions[0])).toBe(true);
  expect(summarizeSession(history.sessions[0]).overall).toEqual({ correct: 1, attempts: 2, percentage: 50 });
  const active = JSON.parse(fixture.records['curricuplay.four-corners.v1']);
  expect(isGameSession(active.session)).toBe(true);
  expect(active.correctTeamIds).toEqual(['team-2']);
  expect(summarizeSession(active.session).teams.map(team => team.score)).toEqual([1, 0]);
});

test('Version 2 export copies all 9 allowlisted records verbatim with SHA-256 fingerprints', async () => {
  const original = { ...fixture.records, 'curricuplay.game.v1': '{corrupt but recoverable', ...bee, [BINGO_ACTIVE_KEY]: '{"version":1,"screen":"setup"}', 'auth-token': 'never export' };
  const store = storage(original);
  const writes: string[] = [];
  const spy = { getItem: store.getItem, setItem: (key: string) => { writes.push(key); } };
  const archive = captureBrowserExport(spy, 'https://example.test');
  expect(archive.format).toBe('classthread-browser-archive');
  expect(archive.version).toBe(2);
  expect(Object.keys(archive.records)).toEqual([...exportKeys]);
  expect(exportKeys).toHaveLength(9);
  for (const key of exportKeys) expect(archive.records[key]).toBe(original[key]);
  const file = await withChecksums(archive);
  expect(Object.keys(file.checksums)).toEqual([...exportKeys]);
  for (const key of exportKeys) expect(file.checksums[key]).toBe(sha256(original[key]));
  expect(JSON.stringify(file)).not.toContain('never export');
  expect(JSON.stringify(file)).not.toContain('auth-token');
  expect(writes).toEqual([]);
  for (const [key, value] of Object.entries(original)) expect(store.getItem(key)).toBe(value);
});

test('Stored snapshot stays version 1 with 5 keys and still downloads with its 5 fingerprints', async () => {
  const store = storage({ ...fixture.records, ...bee });
  preserveBrowserState(store, 'https://example.test');
  const stored = JSON.parse(store.getItem(backupKey)!);
  expect(stored.version).toBe(1);
  expect(Object.keys(stored.records)).toEqual([...legacyKeys]);
  expect(JSON.stringify(stored)).not.toContain('spelling-bee');
  const file = await withChecksums(stored);
  expect(file.version).toBe(1);
  expect(file.records).toEqual(stored.records);
  expect(Object.keys(file.checksums)).toEqual([...legacyKeys]);
  for (const key of legacyKeys) expect(file.checksums[key]).toBe(sha256(stored.records[key]));
});

test('Games export download includes Spelling Bee records and fingerprints without changing storage', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(records => { for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); localStorage.setItem('auth-token', 'never-export-me'); }, bee);
  await page.reload();
  // The legacy Games app saves its own state on mount; snapshot only after that settles.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('curricuplay.game.v1'))).not.toBeNull();
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export browser Games data' }).click()]);
  const text = await readFile((await download.path())!, 'utf8');
  const archive = JSON.parse(text);
  expect(archive.version).toBe(2);
  expect(Object.keys(archive.records)).toEqual([...exportKeys]);
  for (const [key, value] of Object.entries(bee)) {
    expect(archive.records[key]).toBe(value);
    expect(archive.checksums[key]).toBe(sha256(value));
  }
  expect(text).not.toContain('never-export-me');
  await expect(page.getByText('Games backup downloaded, including Spelling Bee. Nothing was uploaded.')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))).toBe(before);
});

test('When the preservation write fails, the download keeps pre-mount legacy values and adds current Spelling Bee records', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(records => { localStorage.clear(); for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value); }, { ...fixture.records, ...bee });
  await page.addInitScript(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new Error('quota'); return setItem.call(this, name, value); };
  }, backupKey);
  await page.reload();
  await expect(page.getByText('could not save a preservation backup')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), backupKey)).toBeNull();
  // Simulate a legacy component overwriting its record after mount; the export must keep the pre-mount value.
  await page.evaluate(() => localStorage.setItem('curricuplay.game.v1', 'written after mount'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export browser Games data' }).click()]);
  const archive = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(archive.version).toBe(2);
  expect(Object.keys(archive.records)).toEqual([...exportKeys]);
  expect(archive.records).toEqual({ ...fixture.records, ...bee, [BINGO_ACTIVE_KEY]: null });
  for (const key of exportKeys) expect(archive.checksums[key]).toBe(sha256(archive.records[key]));
});
