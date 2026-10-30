import { test, expect } from '@playwright/test';
import { classroomQuestions } from '../src/services/classroomPack';
import { createQuestionEngine, questionStatus, questionTaughtDate } from '../src/services/questionEngine';
import { bank as cornerBank, eligible } from '../src/games/four-corners/engine';
import { selectBank } from '../src/games/spelling-bee/bank';
import pacedJeopardy from '../src/data/paced-jeopardy.json' with { type: 'json' };
import pacedCorners from '../src/data/paced-four-corners.json' with { type: 'json' };
import approvals from '../content/paced/2026-10/approvals.json' with { type: 'json' };
import novApprovals from '../content/paced/2026-11/approvals.json' with { type: 'json' };
import pacingBank from '../src/data/spelling-bee-pacing.json' with { type: 'json' };

const decisions = approvals.decisions as Record<string, string>;
const held = approvals.held as Record<string, string>;
const OCT = 'classthread-paced-2026-10', NOV = 'classthread-paced-2026-11';
const october = <T extends { packId: string }>(qs: T[]) => qs.filter(q => q.packId === OCT);

test('October batch: only teacher-approved items ship, in every game', () => {
  const octJ = october(pacedJeopardy), octC = october(pacedCorners);
  const shipped = [...octJ, ...octC].map(q => q.batchItemId);
  for (const id of shipped) { expect(decisions[id]).toBe('approve'); expect(held[id]).toBeUndefined(); }
  expect(shipped).not.toContain('K-fc-9'); // removed on the review page
  expect(octJ.length).toBe(64); expect(octC.length).toBe(57);
  // The teacher's requested edit is applied.
  expect(octC.find(q => q.batchItemId === '5-fc-2')!.question).toContain('“connect”');
  // Every paced question loads into its game.
  const ids = new Set(classroomQuestions({}).map(q => q.id));
  for (const q of octJ) expect(ids.has(q.id)).toBe(true);
  for (const q of octC) expect(cornerBank.some(c => c.id === q.id)).toBe(true);
});

test('October batch follows the rolling month: hidden before its day, Current for a month, then Review', () => {
  const qs = classroomQuestions({}).filter(q => q.packId === 'classthread-paced-2026-10');
  for (const q of [...qs, ...cornerBank.filter(q => q.packId === 'classthread-paced-2026-10')]) {
    const taught = questionTaughtDate(q)!;
    const before = new Date(Date.parse(taught) - 864e5).toISOString().slice(0, 10);
    expect(questionStatus(q, before)).toBeNull();
    expect(questionStatus(q, taught)).toBe('current');
    const month = new Date(`${taught}T12:00:00Z`); month.setUTCMonth(month.getUTCMonth() + 1);
    expect(questionStatus(q, month.toISOString().slice(0, 10))).toBe('review');
  }
  // An exact teaching day is used when the plan names one; otherwise the Friday of the week.
  const compound = october(pacedJeopardy).find(q => q.batchItemId === '2-fc-8') ?? october(pacedCorners).find(q => q.batchItemId === '2-fc-8')!;
  expect(questionTaughtDate(compound as never)).toBe('2026-10-29');
  const weekOnly = october(pacedJeopardy).find(q => !('taughtOn' in q))!;
  expect(new Date(`${questionTaughtDate(weekOnly as never)}T12:00:00Z`).getUTCDay()).toBe(5);
});

test('October batch on real school days: this week shows, next week stays hidden', () => {
  const engine = createQuestionEngine(classroomQuestions({}));
  const oct23 = engine.getQuestions({ grade: '2', range: 'current', asOf: '2026-10-23', unused: false }).filter(q => q.packId === 'classthread-paced-2026-10');
  expect(oct23.length).toBeGreaterThan(0);
  expect(oct23.every(q => q.weekIntroduced === '2026-10-19')).toBe(true);
  const nov2 = engine.getQuestions({ grade: '2', range: 'current', asOf: '2026-11-02', unused: false }).filter(q => q.packId === 'classthread-paced-2026-10');
  expect(nov2.some(q => q.weekIntroduced === '2026-10-26')).toBe(true);
  // Four Corners: standalone paced questions are eligible without a Jeopardy parent, and never early.
  const fcOct20 = eligible('2', 'Mixed Academic', 'current', '2026-10-20').filter(q => q.packId === 'classthread-paced-2026-10');
  expect(fcOct20.every(q => questionTaughtDate(q)! <= '2026-10-20')).toBe(true);
  expect(eligible('2', 'Social Studies', 'current', '2026-10-30').some(q => q.question === 'What is a region?')).toBe(true);
  expect(eligible('2', 'Social Studies', 'current', '2026-10-23').some(q => q.question === 'What is a region?')).toBe(false);
});

test('Spelling Bee: October words unlock on their days and the Kindergarten letters taught before fall break are in review', () => {
  const k = (today: string, mode: 'current' | 'review' | 'mixed') => selectBank({ grade: 'K', mode, cutoff: today, priorGrade: false }).map(w => w.word);
  expect(k('2026-10-19', 'current')).toContain('rabbit');
  expect(k('2026-10-20', 'current')).not.toContain('dog'); // D starts Wednesday Oct 21
  expect(k('2026-10-21', 'current')).toContain('dog');
  expect(k('2026-10-23', 'mixed')).not.toContain('egg'); // E is the week of Oct 26
  expect(k('2026-10-26', 'current')).toContain('egg');
  // C was taught Sept 23, so it is Review from Oct 23.
  expect(k('2026-10-23', 'review')).toEqual(expect.arrayContaining(['cat', 'can', 'pan', 'pin']));
  expect(k('2026-10-23', 'mixed')).not.toContain('cap'); // held: children call the photo a hat
});

test('November batch: approved items ship; removed, held and Kindergarten photo words do not', () => {
  const dec = novApprovals.decisions as Record<string, string>, hold = novApprovals.held as Record<string, string>;
  const nov = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === NOV);
  expect(nov.length).toBe(189);
  for (const q of nov) { expect(dec[q.batchItemId]).toBe('approve'); expect(hold[q.batchItemId]).toBeUndefined(); }
  for (const id of ['3-jp-17', 'K-jp-1', 'K-jp-11', 'K-jp-15', 'K-jp-0']) expect(nov.map(q => q.batchItemId)).not.toContain(id);
  // Four Corners answers are spread across the corners, not always the first.
  const corners = pacedCorners.filter(q => q.packId === NOV);
  expect(new Set(corners.map(q => q.correctIndex)).size).toBe(4);
  // No Kindergarten Spelling Bee words until their photos exist; Trace's dinosaur edit is applied.
  const novWords = pacingBank.filter(w => w.evidenceId.startsWith('paced-2026-11-'));
  expect(novWords.length).toBe(136);
  expect(novWords.some(w => w.grade === 'K')).toBe(false);
  expect(novWords.find(w => w.word === 'dinosaur')!.clue).toContain('long time ago');
  // Nothing unlocks on Tue Nov 3 (no school), and nothing is visible before Nov 2.
  for (const q of nov) { expect(questionTaughtDate(q)).not.toBe('2026-11-03'); expect(questionStatus(q, '2026-10-30')).toBeNull(); }
  const engine = createQuestionEngine(classroomQuestions({}));
  const nov6 = engine.getQuestions({ grade: '3', range: 'current', asOf: '2026-11-06', unused: false }).filter(q => q.packId === NOV);
  expect(nov6.length).toBeGreaterThan(0);
  expect(nov6.every(q => q.weekIntroduced === '2026-11-02')).toBe(true);
});
