import { test, expect } from '@playwright/test';
import { controlTimer, type BeeState, beginGame, committed, commitResults as timedCommit, finishGame, isBeeState, nextWord, reveal, revealAnotherLetter, toggleTeam as timedToggle } from '../src/games/spelling-bee/engine';
import { letterSlots, nextHintIndex, parseWords, samples, validateWords } from '../src/games/spelling-bee/words';
import { ACTIVE_KEY, HISTORY_KEY, LISTS_KEY, readActive, readHistory, readLists, saveActive, saveHistory, saveList } from '../src/games/spelling-bee/storage';
import { summarizeSession } from '../src/assessment/engine';
const time = '2026-10-08T12:00:00.000Z';
const start = () => beginGame(samples.entries, 'K', 'supported', 'session-1', time, () => 0.99)!;
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
}
test('sample bank is valid, covers K–5, is explicit about provenance, and has no answer leaks in clues', () => {
  expect(samples.errors).toEqual([]); expect(samples.entries).toHaveLength(30);
  for (const g of ['K', '1', '2', '3', '4', '5']) expect(samples.entries.filter(w => w.grade === g)).toHaveLength(5);
  for (const w of samples.entries) { expect(w.source).toContain('not district'); expect(w.clue.toLowerCase()).not.toMatch(new RegExp(`\\b${w.word}\\b`)); }
});
test('custom plain and structured words preserve metadata, require review, and reject malformed entries atomically', () => {
  const parsed = parseWords(' CAT | A pet | CVC | cat | My lesson\nsun | Daytime light | short u | sun', 'K', true);
  expect(parsed.errors).toEqual([]); expect(parsed.entries[0]).toMatchObject({ word: 'cat', grade: 'K', clue: 'A pet', skill: 'CVC', picture: 'cat', source: 'My lesson', kind: 'teacher', reviewStatus: 'approved' });
  expect(parseWords('Cat,dog\nsun', '1', false).entries.every(w => w.reviewStatus === 'pending')).toBe(true);
  for (const text of ['cat,CAT', 'cat123', 'two words', '<img>', 'abcdefghijklmnopq', 'cat | clue | skill | https://unreviewed.test/a.svg', 'cat | a | b | cat | d | extra']) {
    expect(parseWords(text, 'K', true).errors.length).toBeGreaterThan(0); expect(parseWords(text, 'K', true).entries).toEqual([]);
  }
  expect(parseWords('', 'K', true)).toEqual({ entries: [], errors: [] });
  expect(parseWords('x'.repeat(60001), 'K', true).errors).not.toEqual([]);
  expect(validateWords([{ ...samples.entries[0], picture: ['cat'] }]).errors).not.toEqual([]);
  expect(validateWords(Array.from({ length: 201 }, () => samples.entries[0])).errors).not.toEqual([]);
});
test('difficulty always hides at least one letter including single-letter sight words', () => {
  expect(letterSlots('cat', 'supported')).toEqual(['C', '_', 'T']);
  expect(letterSlots('cat', 'missing')).toEqual(['C', '_', '_']);
  expect(letterSlots('cat', 'challenge')).toEqual(['_', '_', '_']);
  for (const d of ['supported', 'missing', 'challenge'] as const) expect(letterSlots('a', d)).toEqual(['_']);
});
test('engine commits six actual responses once, reveal is independent, and attempts exclude drafts', () => {
  const initial = start(); expect(isBeeState(initial)).toBe(true);
  expect(summarizeSession(initial.session).overall.percentage).toBeNull();
  expect(nextWord(initial, time)).toBe(initial);
  let s = toggleTeam(initial, 'team-1'); s = toggleTeam(s, 'team-6');
  expect(summarizeSession(s.session).overall.attempts).toBe(0);
  expect(s.revealed).toBe(false);
  s = commitResults(s, time);
  expect(isBeeState(s)).toBe(true); expect(committed(s)).toBe(true);
  expect(summarizeSession(s.session).overall).toEqual({ correct: 2, attempts: 6, percentage: 2 / 6 * 100 });
  expect(summarizeSession(s.session).teams.map(t => t.score)).toEqual([1, 0, 0, 0, 0, 1]);
  expect(commitResults(s, time)).toBe(s); expect(toggleTeam(s, 'team-2')).toBe(s);
  s = reveal(s); expect(s.revealed).toBe(true);
  s = nextWord(s, time); expect(s.index).toBe(1); expect(s.revealed).toBe(false); expect(s.correctTeamIds).toEqual([]);
  expect(initial.session.responses).toEqual([]);
});
test('exhausted banks end with no repeats, and empty or unapproved banks cannot start', () => {
  let s = start(); const seen: string[] = [];
  while (s.screen === 'play') { seen.push(s.words[s.index].word); s = nextWord(commitResults(s, time), time); }
  expect(new Set(seen).size).toBe(5); expect(isBeeState(s)).toBe(true); expect(s.session.responses).toHaveLength(30);
  expect(summarizeSession(s.session).overall.percentage).toBe(0);
  expect(nextWord(s, time)).toBe(s); expect(finishGame(s, time)).toBe(s);
  expect(beginGame([], 'K', 'supported', 'a', time)).toBeNull();
  expect(beginGame(parseWords('cat', 'K', false).entries, 'K', 'supported', 'a', time)).toBeNull();
});
test('early end excludes uncommitted teams and preserves already committed words', () => {
  let s = nextWord(commitResults(toggleTeam(start(), 'team-1'), time), time);
  s = finishGame(toggleTeam(reveal(s), 'team-2'), time);
  expect(isBeeState(s)).toBe(true); expect(s.session.questions).toHaveLength(1); expect(s.session.responses).toHaveLength(6);
  expect(summarizeSession(s.session).teams.map(t => t.score)).toEqual([1, 0, 0, 0, 0, 0]);
  expect(finishGame(start(), time).session.responses).toHaveLength(0);
});
test('strict recovery rejects duplicated words, invalid scoring, wrong snapshots and malformed state', () => {
  const s = commitResults(start(), time);
  const corruptions = [null, {}, { ...s, index: 99 }, { ...s, words: [s.words[0], s.words[0]] }, { ...s, correctTeamIds: ['team-9'] }, { ...s, correctTeamIds: ['team-1'] }, { ...s, session: { ...s.session, responses: s.session.responses.slice(1) } }, { ...s, session: { ...s.session, responses: s.session.responses.map(r => ({ ...r, pointsAwarded: 10 })) } }, { ...s, screen: 'complete' }, { ...s, session: { ...s.session, questions: s.session.questions.map(q => ({ ...q, prompt: 'Changed answer' })) } }];
  for (const value of corruptions) expect(isBeeState(value)).toBe(false);
});
test('separate storage round-trips snapshots and lists and archives completed sessions idempotently', () => {
  const store = storage(); store.setItem('curricuplay.game.v1', 'untouched');
  const s = reveal(toggleTeam(start(), 'team-1'));
  expect(saveActive(s, store)).toBe(''); expect(readActive(store).state).toEqual(s);
  expect(saveList({ id: 'list', name: 'My list', entries: parseWords('cat', 'K', true).entries }, store)).toBe('');
  expect(readLists(store).lists).toHaveLength(1);
  const ended = finishGame(commitResults(s, time), time);
  expect(saveHistory(ended, store)).toBe(''); expect(saveHistory(ended, store)).toBe('');
  expect(readHistory(store).states).toHaveLength(1); expect(store.getItem('curricuplay.game.v1')).toBe('untouched');
  expect(readActive(store).state?.words).toEqual(s.words);
});
test('corrupt and unavailable storage fails visibly without erasing originals', () => {
  const store = storage();
  for (const key of [ACTIVE_KEY, LISTS_KEY, HISTORY_KEY]) store.setItem(key, '{damaged');
  expect(readActive(store).error).toContain('untouched'); expect(readLists(store).error).toContain('untouched'); expect(readHistory(store).error).toContain('untouched');
  expect(saveActive(start(), store)).toContain('untouched'); expect(saveHistory(finishGame(start(), time), store)).toContain('untouched');
  expect(saveList({ id: 'x', name: 'x', entries: samples.entries }, store)).toContain('untouched');
  for (const key of [ACTIVE_KEY, LISTS_KEY, HISTORY_KEY]) expect(store.getItem(key)).toBe('{damaged');
  const blocked = { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } };
  expect(readActive(blocked).error).toBeTruthy();
  expect(saveActive(start(), { getItem: () => null, setItem: blocked.setItem })).toContain('Keep this tab open');
});
test('adaptive hints scale with length and give long academic words a beginning pair and ending', () => {
  const shown = (word: string) => letterSlots(word, 'missing').filter(c => c !== '_').length;
  expect(shown('ship')).toBe(1); expect(shown('habitat')).toBe(2); expect(shown('photosynthesis')).toBe(3);
  expect(letterSlots('photosynthesis', 'missing').join('')).toBe('PH___________S');
  expect(letterSlots('photosynthesis', 'challenge').every(c => c === '_')).toBe(true);
  for (const entry of samples.entries) {
    for (const difficulty of ['supported', 'missing', 'challenge'] as const) {
      const extra: number[] = [];
      for (let n = 0; n < entry.word.length; n++) {
        const index = nextHintIndex(entry.word, difficulty, extra);
        if (index === undefined) break;
        expect(letterSlots(entry.word, difficulty, extra)[index]).toBe('_');
        extra.push(index);
        expect(letterSlots(entry.word, difficulty, extra)).toContain('_');
      }
      expect(letterSlots(entry.word, difficulty, extra).filter(c => c === '_')).toHaveLength(1);
      expect(nextHintIndex(entry.word, difficulty, extra)).toBeUndefined();
      for (const switched of ['supported', 'missing', 'challenge'] as const) expect(letterSlots(entry.word, switched, extra)).toContain('_');
    }
  }
});
test('extra hints persist, do not affect scores, reset per word, and accept old snapshots', () => {
  let s = beginGame(samples.entries, '5', 'missing', 'hint-game', time, () => .99)!;
  const legacy = { ...s }; delete legacy.extraLetters;
  expect(isBeeState(legacy)).toBe(true);
  s = revealAnotherLetter(legacy);
  expect(s.extraLetters).toHaveLength(1); expect(s.session.responses).toEqual([]);
  const store = storage(); expect(saveActive(s, store)).toBe(''); expect(readActive(store).state).toEqual(s);
  for (const extraLetters of [[-1], [999], [1, 1], [Math.floor(s.words[0].word.length / 2)], [1.5], 'bad']) expect(isBeeState({ ...s, extraLetters })).toBe(false);
  expect(revealAnotherLetter(reveal(s))).toEqual(reveal(s));
  const advanced = nextWord(commitResults(s, time), time);
  expect(advanced.extraLetters).toEqual([]); expect(advanced.revealed).toBe(false); expect(isBeeState(advanced)).toBe(true);
  const ended = finishGame(s, time); expect(revealAnotherLetter(ended)).toBe(ended);
});

// Preserve the original scoring/regression scenarios using the explicit teacher early-end workflow.
function commitResults(s: BeeState, now: string) { return timedCommit(controlTimer(s, 'end', Date.parse(now)), now); }
function toggleTeam(s: BeeState, id: string) { return timedToggle(controlTimer(s, 'end'), id); }
