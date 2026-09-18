import { test, expect } from '@playwright/test';
import { accuracy, commitQuestion, createSession, endSession, formatAccuracy, isGameSession, summarizeSession } from '../src/assessment/engine';
const now = '2026-09-17T12:00:00.000Z';
const make = (teams = 6) => createSession({ id: 'session-1', gameType: 'future-game', grade: '5', mode: 'team', startedAt: now, teams: Array.from({ length: teams }, (_, i) => ({ id: String(i), name: `Team ${i + 1}` })) });
test('Assessment calculates team, class, question and overall accuracy from attempts, not averages', () => {
  let session = make();
  for (let i = 0; i < 6; i++) session = commitQuestion(session, { questionId: `q${i}`, subject: 'Science', prompt: `Question ${i}`, concept: 'Observation' }, session.teams.map((t, n) => ({ teamId: t.id, correct: i < 4 || n < 2, pointsAwarded: i < 4 || n < 2 ? 1 : 0 })), now);
  expect(session.responses).toHaveLength(36);
  let summary = summarizeSession(session);
  expect(summary.subjects[0]).toEqual({ subject: 'Science', correct: 28, attempts: 36, percentage: 28 / 36 * 100 });
  expect(formatAccuracy(summary.overall)).toBe('77.8% (28/36)');
  expect(summary.teams[0].overall).toEqual({ correct: 6, attempts: 6, percentage: 100 });
  expect(summary.teams[2].subjects[0].correct).toBe(4);
  expect(summary.questions[5].correct).toBe(2); expect(summary.questions[5].attempts).toBe(6);
  // A future game can collect a subset of teams and non-unit points; denominator is actual attempts.
  session = commitQuestion(session, { questionId: 'math', subject: 'Math', standards: ['example'], prompt: 'A future Math task' }, [{ teamId: '0', correct: true, pointsAwarded: 5 }], now);
  summary = summarizeSession(session);
  expect(summary.overall.correct).toBe(29); expect(summary.overall.attempts).toBe(37);
  expect(summary.teams[0].score).toBe(11);
  expect(summary.subjects.map(s => s.subject)).toEqual(['Science', 'Math']);
});
test('Dynamic subjects, zero attempts, and single-team sessions require no game-specific branches', () => {
  let session = make(1);
  expect(formatAccuracy(accuracy([]))).toBe('—');
  expect(summarizeSession(session, ['Math', 'Music']).subjects.every(s => s.percentage === null && s.attempts === 0)).toBe(true);
  session = commitQuestion(session, { questionId: 'music', subject: 'Music', prompt: 'Rhythm', standards: ['MUSIC-1'] }, [{ teamId: '0', correct: false, pointsAwarded: 0 }], now);
  const summary = summarizeSession(session, ['Math']);
  expect(formatAccuracy(summary.subjects[0])).toBe('0% (0/1)');
  expect(formatAccuracy(summary.teams[0].subjects[1])).toBe('—');
  expect(isGameSession(session)).toBe(true);
});
test('Commit is immutable and idempotent; ending freezes the exact committed data', () => {
  const initial = make();
  const q = { questionId: 'q', subject: 'Art', prompt: 'Color', standards: ['ART-1'] };
  const committed = commitQuestion(initial, q, [{ teamId: '0', correct: true, pointsAwarded: 1 }], now);
  q.standards[0] = 'changed';
  expect(committed.questions[0].standards).toEqual(['ART-1']);
  expect(initial.questions).toEqual([]); expect(initial.responses).toEqual([]);
  expect(commitQuestion(committed, q, [], now)).toBe(committed);
  const ended = endSession(committed, now);
  expect(commitQuestion(ended, { ...q, questionId: 'other' }, [], now)).toBe(ended);
  expect(endSession(ended, '2026-09-18T12:00:00.000Z')).toBe(ended);
  expect(ended.questions).toHaveLength(1); expect(ended.responses).toHaveLength(1);
});
test('Invalid and duplicate outcomes cannot enter a session', () => {
  const q = { questionId: 'q', subject: 'Art', prompt: 'Color' };
  const outcome = { teamId: '0', correct: true, pointsAwarded: 1 };
  expect(() => commitQuestion(make(), q, [outcome, outcome], now)).toThrow();
  expect(() => commitQuestion(make(), q, [{ ...outcome, teamId: 'missing' }], now)).toThrow();
  expect(() => commitQuestion(make(), q, [{ ...outcome, pointsAwarded: NaN }], now)).toThrow();
  const committed = commitQuestion(make(), q, [outcome], now);
  expect(isGameSession({ ...committed, responses: [...committed.responses, ...committed.responses] })).toBe(false);
  expect(isGameSession({ ...committed, responses: [{ ...committed.responses[0], subject: 'Math' }] })).toBe(false);
  for (const value of [null, {}, { ...committed, teams: [null] }, { ...committed, endedAt: 'bad date' }]) expect(isGameSession(value)).toBe(false);
});
