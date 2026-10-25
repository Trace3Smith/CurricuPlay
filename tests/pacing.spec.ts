import { test, expect } from '@playwright/test';
import { schoolDate, selectCurriculum, type CurriculumEvidence, type CurriculumSelection } from '../src/curriculum/eligibility';
import { addMonths, currentWindow, fridayOf, pacingStatus, selectPaced, shortDate, taughtDate } from '../src/curriculum/pacing';
import { curriculumBank, selectBank } from '../src/games/spelling-bee/bank';
import { beginGame, isBeeState, commitResults, controlTimer, type BeeState } from '../src/games/spelling-bee/engine';
import { ACTIVE_KEY, HISTORY_KEY, readActive, readHistory, saveActive } from '../src/games/spelling-bee/storage';
import { grades, type Grade } from '../src/types';

const base = curriculumBank.find(w => w.grade === '2' && w.curriculum?.timing === 'documented')!.curriculum!;
const evidence = (periods: { start: string; end: string }[], earliestEligible: string): CurriculumEvidence => ({ ...base, periods, earliestEligible });
const day = (date: string) => evidence([{ start: date, end: date }], date);
const config = (grade: Grade, mode: CurriculumSelection['mode'], cutoff: string, priorGrade = false): CurriculumSelection => ({ grade, mode, cutoff, priorGrade });
function dates(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) out.push(d); return out; }
function memory() { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; }

test('taught Sept 20 is hidden before, Current through Oct 19, and Review from Oct 20', () => {
  const taught = taughtDate(day('2026-09-20'));
  expect(taught).toBe('2026-09-20');
  expect(pacingStatus(taught, '2026-09-19')).toBeNull();
  expect(pacingStatus(taught, '2026-09-20')).toBe('current');
  expect(pacingStatus(taught, '2026-10-19')).toBe('current');
  expect(pacingStatus(taught, '2026-10-20')).toBe('review');
  expect(pacingStatus(taught, '2027-06-01')).toBe('review');
  expect(pacingStatus(taught, 'not-a-date')).toBeNull();
});

test('month ends clamp to the shorter month', () => {
  expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  const taught = taughtDate(day('2027-01-31'));
  expect(pacingStatus(taught, '2027-02-27')).toBe('current');
  expect(pacingStatus(taught, '2027-02-28')).toBe('review');
  expect(currentWindow('2027-02-28')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
});

test('week-only evidence counts as taught on the Friday of its week; exact days are kept', () => {
  expect(fridayOf('2026-10-05')).toBe('2026-10-09');
  expect(fridayOf('2026-10-09')).toBe('2026-10-09');
  expect(fridayOf('2026-10-11')).toBe('2026-10-09');
  expect(taughtDate(evidence([{ start: '2026-10-05', end: '2026-10-09' }], '2026-10-09'))).toBe('2026-10-09');
  // A short (holiday) week listed Mon–Wed still counts on its Friday, never before the week-end eligibility date.
  expect(taughtDate(evidence([{ start: '2026-11-23', end: '2026-11-25' }], '2026-11-25'))).toBe('2026-11-27');
  expect(taughtDate(evidence([{ start: '2026-10-14', end: '2026-10-14' }], '2026-10-14'))).toBe('2026-10-14');
  for (const patch of [{ timing: 'unknown' }, { timing: 'conflicting' }, { review: 'pending' }, { earliestEligible: null }, { category: 'general' }])
    expect(taughtDate({ ...base, ...patch } as CurriculumEvidence)).toBeNull();
  for (const w of curriculumBank.filter(w => taughtDate(w.curriculum))) {
    const period = w.curriculum!.periods[0];
    // Exact teaching days (single-day periods from lesson plans) are kept; week-only items count on Friday.
    if (period.start === period.end) expect(taughtDate(w.curriculum)).toBe(period.start);
    else expect(new Date(`${taughtDate(w.curriculum)}T12:00:00Z`).getUTCDay()).toBe(5);
    expect(taughtDate(w.curriculum)).toBe(w.curriculum!.earliestEligible);
  }
});

test('future, conflicting, and unapproved items never appear on any date in the school year', () => {
  const conflicting = new Set(curriculumBank.filter(w => w.curriculum?.timing !== 'documented').map(w => w.id));
  // The former Kindergarten Unit 2 conflict is resolved from lesson plans; the rule still holds for any future conflict.
  expect(curriculumBank.find(w => w.id === 'pacing-K-cat')!.curriculum!.timing).toBe('documented');
  const violations: string[] = [];
  for (const date of dates('2026-08-01', '2027-06-30')) for (const grade of grades) for (const mode of ['current', 'review', 'mixed'] as const) {
    for (const w of selectBank(config(grade, mode, date, mode === 'mixed'))) {
      const taught = taughtDate(w.curriculum);
      if (!taught || taught > date || conflicting.has(w.id) || (date < '2026-11-13' && ['conductor', 'insulator'].includes(w.word))) violations.push(`${date} ${grade} ${mode} ${w.id}`);
    }
  }
  expect(violations).toEqual([]);
  expect(selectBank(config('5', 'current', '2026-11-12')).some(w => w.word === 'conductor')).toBe(false);
  expect(selectBank(config('5', 'current', '2026-11-13')).some(w => w.word === 'conductor')).toBe(true);
  // The engine refuses a future item even if a caller passes one in.
  const conductor = curriculumBank.filter(w => w.word === 'conductor');
  expect(beginGame(conductor, '5', 'missing', 'x', '2026-11-01T12:00:00Z', Math.random, { selection: config('5', 'current', '2026-11-12'), reviewed: true, untilStop: true, choices: 0 })).toBeNull();
  expect(beginGame(conductor, '5', 'missing', 'x', '2026-11-13T12:00:00Z', Math.random, { selection: config('5', 'review', '2026-11-13'), reviewed: true, untilStop: true, choices: 0 })).toBeNull();
});

test('modes split Current and Review on the rolling window; Current is newest-taught first', () => {
  const current = selectBank(config('2', 'current', '2026-10-09')), review = selectBank(config('2', 'review', '2026-10-09')), mixed = selectBank(config('2', 'mixed', '2026-10-09'));
  expect(current.length + review.length).toBe(mixed.length);
  expect(new Set([...current, ...review].map(w => w.id)).size).toBe(mixed.length);
  for (const w of current) expect(taughtDate(w.curriculum)! >= '2026-09-10').toBe(true);
  for (const w of review) expect(taughtDate(w.curriculum)! < '2026-09-10').toBe(true);
  const taught = current.map(w => taughtDate(w.curriculum)!);
  expect(new Set(taught).size).toBeGreaterThan(1);
  expect(taught).toEqual([...taught].sort().reverse());
  const s = beginGame(current, '2', 'missing', 'newest', '2026-10-09T12:00:00Z', () => .42, { selection: config('2', 'current', '2026-10-09'), reviewed: true, untilStop: true, choices: 0 })!;
  const played = s.flow!.order.map(id => taughtDate(s.words.find(w => w.id === id)!.curriculum)!);
  expect(played).toEqual([...played].sort().reverse());
  // Prior-Grade Review remains available in Current + Review for grade 2 and above.
  expect(selectBank(config('3', 'mixed', '2026-10-09', true)).some(w => w.grade === '2')).toBe(true);
  expect(selectBank(config('3', 'current', '2026-10-09', true)).every(w => w.grade === '3')).toBe(true);
  expect(selectPaced(curriculumBank, { grade: '2', today: 'bad', mode: 'mixed', priorGrade: false })).toEqual([]);
});

test('explanation text and default date follow today in America/New_York', () => {
  expect(shortDate('2026-09-18')).toBe('Sept 18');
  expect(currentWindow('2026-10-17')).toEqual({ start: '2026-09-18', end: '2026-10-17' });
  expect(currentWindow('2026-10-19')).toEqual({ start: '2026-09-20', end: '2026-10-19' });
  expect(schoolDate(new Date('2026-10-18T02:30:00Z'))).toBe('2026-10-17');
});

test('old cutoff-based saves, legacy "previous" mode, and history load unchanged', () => {
  const now = '2026-10-09T14:00:00.000Z';
  const options = (selection: CurriculumSelection) => ({ selection, reviewed: true, untilStop: true, choices: 0 as const });
  // Saved before this change: week-based "previous" and "current" selections at the old fixed cutoff.
  const previous = config('2', 'previous', '2026-10-09');
  const legacyPrevious = beginGame(selectCurriculum(curriculumBank, previous), '2', 'missing', 'old-previous', now, () => .3, options(previous))!;
  expect(legacyPrevious.words).toHaveLength(28);
  const weekCurrent = config('2', 'current', '2026-10-09');
  const oldCurrent: BeeState = { ...beginGame(selectCurriculum(curriculumBank, weekCurrent), '2', 'missing', 'old-current', now, () => .3, options(weekCurrent))! };
  expect(oldCurrent.words).toHaveLength(12);
  const v1 = beginGame(curriculumBank.filter(w => w.grade === '2').slice(0, 5).map(w => ({ ...w, curriculum: undefined, kind: 'sample' as const })), '2', 'missing', 'old-v1', now, () => .3)!;
  const done = { ...legacyPrevious, screen: 'complete' as const, session: { ...legacyPrevious.session, endedAt: now } };
  for (const s of [legacyPrevious, oldCurrent, v1, commitResults(controlTimer(legacyPrevious, 'end', Date.parse(now)), now)]) {
    expect(isBeeState(s)).toBe(true);
    const store = memory(), raw = JSON.stringify(s);
    store.setItem(ACTIVE_KEY, raw);
    expect(readActive(store).state).toEqual(s);
    expect(store.getItem(ACTIVE_KEY)).toBe(raw);
  }
  const store = memory(), history = JSON.stringify({ version: 1, states: [done] });
  store.setItem(HISTORY_KEY, history);
  expect(readHistory(store).states).toEqual([done]);
  expect(saveActive(legacyPrevious, store)).toBe('');
  expect(store.getItem(HISTORY_KEY)).toBe(history);
});
