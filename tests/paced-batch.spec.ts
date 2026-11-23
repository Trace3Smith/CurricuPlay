import { test, expect } from '@playwright/test';
import { classroomQuestions } from '../src/services/classroomPack';
import { createQuestionEngine, questionStatus, questionTaughtDate } from '../src/services/questionEngine';
import { bank as cornerBank, eligible } from '../src/games/four-corners/engine';
import { selectBank } from '../src/games/spelling-bee/bank';
import pacedJeopardy from '../src/data/paced-jeopardy.json' with { type: 'json' };
import pacedCorners from '../src/data/paced-four-corners.json' with { type: 'json' };
import approvals from '../content/paced/2026-10/approvals.json' with { type: 'json' };
import novApprovals from '../content/paced/2026-11/approvals.json' with { type: 'json' };
import decApprovals from '../content/paced/2026-12/approvals.json' with { type: 'json' };
import janApprovals from '../content/paced/2027-01/approvals.json' with { type: 'json' };
import pacingBank from '../src/data/spelling-bee-pacing.json' with { type: 'json' };

const decisions = approvals.decisions as Record<string, string>;
const held = approvals.held as Record<string, string>;
const OCT = 'classthread-paced-2026-10', NOV = 'classthread-paced-2026-11', DEC = 'classthread-paced-2026-12', JAN = 'classthread-paced-2027-01';
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
  expect(k('2026-10-23', 'mixed')).toContain('cap'); // released: children who call the photo a hat are accepted with H
});

test('November batch: approved items ship; removed, held and Kindergarten photo words do not', () => {
  const dec = novApprovals.decisions as Record<string, string>, hold = novApprovals.held as Record<string, string>;
  const nov = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === NOV);
  expect(nov.length).toBe(209);
  for (const q of nov) { expect(dec[q.batchItemId]).toBe('approve'); expect(hold[q.batchItemId]).toBeUndefined(); }
  for (const id of ['3-jp-17', 'K-jp-1', 'K-jp-11', 'K-jp-15', 'K-jp-0']) expect(nov.map(q => q.batchItemId)).not.toContain(id);
  // Four Corners answers are spread across the corners, not always the first.
  const corners = pacedCorners.filter(q => q.packId === NOV);
  expect(new Set(corners.map(q => q.correctIndex)).size).toBe(4);
  // No Kindergarten Spelling Bee words until their photos exist; Trace's dinosaur edit is applied.
  const novWords = pacingBank.filter(w => w.evidenceId.startsWith('paced-2026-11-'));
  expect(novWords.length).toBe(127);
  expect(novWords.some(w => w.grade === 'K')).toBe(false);
  // Grade 3 explorer items: held on Nov 2, released on Nov 9 once the plan showed the explorers unit.
  for (const id of ['3-jp-5', '3-fc-3', '3-fc-4']) { expect(hold[id]).toBeUndefined(); expect(nov.map(q => q.batchItemId)).toContain(id); }
  for (const id of ['3-sb-6', '3-sb-7', '3-sb-8']) expect(novWords.map(w => w.evidenceId)).toContain(`paced-2026-11-${id}`);
  // Nov 2 review: new items added, the removed Piedmont question left out.
  for (const id of ['1-jp-w1', '1-jp-w2', '5-jp-w1']) expect(nov.map(q => q.batchItemId)).toContain(id);
  expect(novWords.map(w => w.word)).toEqual(expect.arrayContaining(['conflict', 'setting']));
  // Removed on Nov 2 and never added; its id 2-jp-w1 was reused on Nov 9 for an approved Georgia rivers question.
  expect(nov.some(q => q.question.includes('Atlanta') && q.question.includes('five regions'))).toBe(false);
  expect(nov.find(q => q.batchItemId === '2-jp-w1')!.question).toContain('eastern border');
  expect(nov.find(q => q.batchItemId === '1-jp-3')!.taughtOn).toBe('2026-11-05');
  expect(novWords.find(w => w.word === 'firsthand')!.curriculum.earliestEligible).toBe('2026-11-02');
  expect(novWords.find(w => w.word === 'dinosaur')!.clue).toContain('long time ago');
  // Nothing unlocks on Tue Nov 3 (no school), and nothing is visible before Nov 2.
  for (const q of nov) { expect(questionTaughtDate(q)).not.toBe('2026-11-03'); expect(questionStatus(q, '2026-10-30')).toBeNull(); }
  const engine = createQuestionEngine(classroomQuestions({}));
  const nov6 = engine.getQuestions({ grade: '3', range: 'current', asOf: '2026-11-06', unused: false }).filter(q => q.packId === NOV);
  expect(nov6.length).toBeGreaterThan(0);
  expect(nov6.every(q => q.weekIntroduced === '2026-11-02')).toBe(true);
});

test('Nov 9 review: exact days, the Grade 2 government items, and new items under unused ids', () => {
  const dec = novApprovals.decisions as Record<string, string>, hold = novApprovals.held as Record<string, string>;
  const nov = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === NOV);
  const item = (id: string) => nov.find(q => q.batchItemId === id)!;
  // Laws question removed; the Nov 16 government items were held, then removed in the Nov 16 review.
  // The Nov 30 review released their hold, but the Nov 16 removal still stands.
  expect(dec['2-jp-13']).toBe('remove');
  for (const id of ['2-jp-19', '2-fc-13']) expect(dec[id]).toBe('remove');
  for (const id of ['2-jp-13', '2-jp-19', '2-fc-13']) expect(nov.map(q => q.batchItemId)).not.toContain(id);
  for (const id of ['2-jp-19', '2-fc-13']) expect(hold[id]).toBeUndefined();
  // Teaching days from the lesson plans.
  expect(item('2-jp-8').taughtOn).toBe('2026-11-10');
  expect(item('2-jp-9').taughtOn).toBe('2026-11-12');
  expect(item('1-jp-11').taughtOn).toBe('2026-11-11');
  expect(item('5-fc-5').taughtOn).toBe('2026-11-09');
  // The bundle reused three Nov 2 ids for different questions; both the old and the renamed new items ship.
  expect(item('1-jp-w1').question).toContain('compound word');
  expect(item('1-jp-w3').question).toContain('kelp forest');
  expect(item('1-jp-w4').question).toContain('deepest parts of the ocean');
  expect(item('5-jp-w2').question).toContain('cap/cept');
  // Nothing from the week of Nov 9 is visible the Friday before.
  const engine = createQuestionEngine(classroomQuestions({}));
  for (const grade of ['K', '1', '2', '3', '4', '5'] as const) {
    const early = engine.getQuestions({ grade, range: 'current', asOf: '2026-11-06', unused: false }).filter(q => q.packId === NOV);
    expect(early.some(q => q.weekIntroduced === '2026-11-09')).toBe(false);
  }
});

test('December batch: approved Nov 30, Dec 7 and Dec 14 items ship; removed and Kindergarten photo words do not', () => {
  const dec = decApprovals.decisions as Record<string, string>, hold = decApprovals.held as Record<string, string>;
  const qs = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === DEC);
  expect(pacedJeopardy.filter(q => q.packId === DEC).length).toBe(109);
  expect(pacedCorners.filter(q => q.packId === DEC).length).toBe(84);
  for (const q of qs) { expect(dec[q.batchItemId]).toBe('approve'); expect(hold[q.batchItemId]).toBeUndefined(); }
  expect(new Set(qs.map(q => q.weekIntroduced))).toEqual(new Set(['2026-11-30', '2026-12-07', '2026-12-14']));
  const words = pacingBank.filter(w => w.evidenceId.startsWith('paced-2026-12-'));
  expect(words.length).toBe(125);
  expect(words.some(w => w.grade === 'K')).toBe(false);
  for (const id of ['K-sb-2', 'K-sb-4', 'K-sb-12', 'K-sb-14']) expect(dec[id]).toBe('remove');
  // 24 Kindergarten items held (23 photo words, K-jp-w1 for images) plus 36 Nov 30 review holds.
  expect(Object.keys(hold)).toHaveLength(60);
  // Georgia First People: 2-jp-6 released for Nov 30 (class teaches it now); 2-jp-14 and 2-fc-9 removed.
  expect(hold['2-jp-6']).toBeUndefined();
  expect(qs.find(q => q.batchItemId === '2-jp-6')!.taughtOn).toBe('2026-11-30');
  for (const id of ['2-jp-14', '2-fc-9']) { expect(dec[id]).toBe('remove'); expect(qs.map(q => q.batchItemId)).not.toContain(id); }
  // Nothing is visible before Nov 30, and every item is Current on its taught day.
  for (const q of qs) {
    expect(questionStatus(q, '2026-11-27')).toBeNull();
    expect(questionStatus(q, questionTaughtDate(q)!)).toBe('current');
  }
});

test('Nov 16 review: new days, holds and removals for the week of Nov 16', () => {
  const dec = novApprovals.decisions as Record<string, string>, hold = novApprovals.held as Record<string, string>;
  const nov = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === NOV);
  const ids = nov.map(q => q.batchItemId);
  const item = (id: string) => nov.find(q => q.batchItemId === id)!;
  // Exact days from the classroom plans; the circuits items move to Friday.
  expect(item('K-fc-10').taughtOn).toBe('2026-11-17');
  expect(item('1-fc-10').taughtOn).toBe('2026-11-16');
  expect(item('1-jp-16').taughtOn).toBe('2026-11-17');
  expect(item('2-fc-12').taughtOn).toBe('2026-11-17');
  expect(item('5-jp-21').taughtOn).toBeUndefined();
  expect(questionTaughtDate(item('5-jp-21'))).toBe('2026-11-20');
  // Held until a plan shows the topic.
  for (const id of ['3-jp-12', '3-fc-9', '4-jp-16', '4-fc-10']) {
    expect(hold[id]).toContain('Nov 16 review'); expect(ids).not.toContain(id);
  }
  // Later re-dated to the weeks the class teaches them (Nov 30 review), so removed here.
  for (const id of ['K-fc-11', 'K-fc-12', '1-jp-13', '2-jp-14', '2-fc-9']) { expect(dec[id]).toBe('remove'); expect(ids).not.toContain(id); }
  // Removed (K-jp-w3 was a removed new item, so it was never added).
  for (const id of ['3-jp-13', '3-fc-10', '5-jp-16', '5-fc-10']) { expect(dec[id]).toBe('remove'); expect(ids).not.toContain(id); }
  expect(ids).not.toContain('K-jp-w3');
  // Kept as is.
  for (const id of ['K-jp-19', 'K-fc-14', '1-jp-15', '3-jp-16', '3-fc-12', '5-jp-18', '5-jp-19', '5-jp-17', '5-fc-11']) expect(ids).toContain(id);
});

test('Nov 30 review: new days, holds and re-dated copies for the week of Nov 30', () => {
  const dec = decApprovals.decisions as Record<string, string>, hold = decApprovals.held as Record<string, string>;
  const novHold = novApprovals.held as Record<string, string>;
  const qs = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === DEC);
  const ids = qs.map(q => q.batchItemId);
  const item = (id: string) => qs.find(q => q.batchItemId === id)!;
  const words = pacingBank.filter(w => w.evidenceId.startsWith('paced-2026-12-'));
  // Exact days from the class plans.
  expect(item('K-jp-0').taughtOn).toBe('2026-12-03');
  expect(item('K-jp-1').taughtOn).toBe('2026-12-04');
  expect(item('1-fc-3').taughtOn).toBe('2026-11-30');
  expect(item('1-jp-1').taughtOn).toBe('2026-12-01');
  expect(item('2-jp-4').taughtOn).toBe('2026-12-02');
  expect(item('2-jp-5').taughtOn).toBe('2026-12-01');
  expect(item('3-jp-0').taughtOn).toBe('2026-12-02');
  expect(words.find(w => w.evidenceId === 'paced-2026-12-1-sb-5')!.curriculum.earliestEligible).toBe('2026-12-02');
  // Held until the class reaches them; the Letter U words keep their photo hold.
  for (const id of ['1-fc-0', '2-jp-0', '2-fc-4', '3-jp-1', '3-fc-1', '4-fc-2']) { expect(hold[id]).toContain('Nov 22 review'); expect(ids).not.toContain(id); }
  for (const id of ['1-sb-0', '2-sb-0', '3-sb-0']) expect(words.map(w => w.evidenceId)).not.toContain(`paced-2026-12-${id}`);
  for (const id of ['K-sb-0', 'K-sb-1', 'K-sb-3']) expect(hold[id]).toContain('photo');
  // Story mountain stays held, with both reasons kept.
  expect(novHold['3-jp-12']).toContain('Nov 16 review'); expect(novHold['3-jp-12']).toContain('Nov 22 review');
  // New Nov 30 items, including re-dated copies of removed Nov 16 items.
  for (const id of ['K-fc-w1', 'K-fc-w2', '1-jp-w1', '1-fc-w1', '2-jp-w3', '2-fc-w1', '3-jp-w1', '3-fc-w1']) expect(ids).toContain(id);
  expect(item('K-fc-w2').question).toContain('tree');
  expect(words.map(w => w.word)).toEqual(expect.arrayContaining(['brick', 'swing', 'people', 'boat', 'nectar', 'illustration']));
  for (const id of ['K-jp-w1', 'K-sb-w1']) { expect(hold[id]).toBeDefined(); expect(ids).not.toContain(id); }
  // Kept on hold in November.
  for (const id of ['1-sb-26', '2-jp-16', '4-fc-11']) expect(novHold[id]).toBeDefined();
});

test('January batch: approved Jan 5 week items ship from Tue Jan 5; Kindergarten photo words do not', () => {
  const dec = janApprovals.decisions as Record<string, string>, hold = janApprovals.held as Record<string, string>;
  const qs = [...pacedJeopardy, ...pacedCorners].filter(q => q.packId === JAN);
  expect(pacedJeopardy.filter(q => q.packId === JAN).length).toBe(38);
  expect(pacedCorners.filter(q => q.packId === JAN).length).toBe(30);
  for (const q of qs) { expect(dec[q.batchItemId]).toBe('approve'); expect(hold[q.batchItemId]).toBeUndefined(); }
  expect(new Set(qs.map(q => q.weekIntroduced))).toEqual(new Set(['2027-01-04']));
  const words = pacingBank.filter(w => w.evidenceId.startsWith('paced-2027-01-'));
  expect(words.length).toBe(48);
  expect(words.some(w => w.grade === 'K')).toBe(false);
  expect(Object.keys(hold)).toHaveLength(9);
  for (const v of Object.values(hold)) expect(v).toBe('Kindergarten photo not made yet (image generation)');
  // Every paced question loads into its game; nothing shows before students return on Tue Jan 5.
  const loaded = new Set(classroomQuestions({}).map(q => q.id));
  for (const q of pacedJeopardy.filter(q => q.packId === JAN)) expect(loaded.has(q.id)).toBe(true);
  for (const q of pacedCorners.filter(q => q.packId === JAN)) expect(cornerBank.some(c => c.id === q.id)).toBe(true);
  for (const q of qs) {
    expect(questionTaughtDate(q)! >= '2027-01-05').toBe(true);
    expect(questionStatus(q, '2027-01-04')).toBeNull();
    expect(questionStatus(q, questionTaughtDate(q)!)).toBe('current');
  }
  const engine = createQuestionEngine(classroomQuestions({}));
  expect(engine.getQuestions({ grade: '3', range: 'current', asOf: '2027-01-08', unused: false }).some(q => q.packId === JAN)).toBe(true);
  expect(eligible('3', 'Mixed Academic', 'current', '2027-01-08').some(q => q.packId === JAN)).toBe(true);
  expect(selectBank({ grade: '3', mode: 'current', cutoff: '2027-01-08', priorGrade: false }).some(w => words.some(x => x.word === w.word))).toBe(true);
});
