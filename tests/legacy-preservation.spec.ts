import { test, expect } from '@playwright/test';
import fixture from './fixtures/legacy-browser-state.v1.json' with { type: 'json' };
import { backupKey, captureBrowserState, legacyKeys, preserveBrowserState } from '../src/integrations/legacy-storage/preservation';
import { isGameSession, summarizeSession } from '../src/assessment/engine';

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
