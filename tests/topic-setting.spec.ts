import { test, expect, type Page } from '@playwright/test';
import { eligible, gradeTopics, topicFor, STORAGE_KEY as CORNER_KEY, type CornerQuestion } from '../src/games/four-corners/engine';
import { begin, freshState as quickFresh, isQuickState, pool, startOver, next, reveal, toSetup, QUICK_CHECK_KEY } from '../src/games/quick-check/engine';
import { questionStatus, questionTaughtDate } from '../src/services/questionEngine';
import { grades } from '../src/types';
import pacedCorners from '../src/data/paced-four-corners.json' with { type: 'json' };
import review from '../content/paced/2026-27-decoding/review.json' with { type: 'json' };
import approvals from '../content/paced/2026-27-decoding/approvals.json' with { type: 'json' };

const DC = 'classthread-paced-2026-27-decoding';
const FRIDAY = '2026-11-20';
const decoding = pacedCorners.filter(q => q.packId === DC) as unknown as CornerQuestion[];
const labels: Record<string, string> = { K: 'Kindergarten', '1': '1st Grade', '2': '2nd Grade', '3': '3rd Grade', '4': '4th Grade', '5': '5th Grade' };
const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);

test('Decoding batch: all 52 approved items ship, grades 1–5, each unlocking on its Friday', () => {
  expect(review).toHaveLength(52);
  expect(Object.values(approvals.decisions)).toEqual(Array(52).fill('approve'));
  expect(approvals.held).toEqual({});
  expect(decoding).toHaveLength(52);
  expect(Object.fromEntries(['1', '2', '3', '4', '5'].map(g => [g, decoding.filter(q => q.grade === g).length]))).toEqual({ '1': 10, '2': 12, '3': 10, '4': 10, '5': 10 });
  // The Nov 24 items, not the Nov 20 bundle's withdrawn -dc- drafts (e.g. its "closed syllable: cat" item).
  expect(decoding.find(q => q.batchItemId === '1-dc-1')!.choices).toEqual(['cupcake', 'napkin', 'sunset', 'muffin']);
  expect(decoding.some(q => q.choices.includes('cat'))).toBe(false);
  expect(new Set(decoding.map(q => q.id)).size).toBe(52);
  for (const q of decoding) {
    expect([q.subject, q.topic, q.spokenTarget]).toEqual(['Literacy', 'decoding', undefined]);
    expect(q.choices[q.correctIndex]).toBe(q.answer);
    const taught = questionTaughtDate(q)!;
    expect(new Date(`${taught}T12:00:00Z`).getUTCDay()).toBe(5);
    expect(questionStatus(q, new Date(Date.parse(taught) - 864e5).toISOString().slice(0, 10))).toBeNull();
    expect(questionStatus(q, taught)).toBe('current');
  }
  // Repeated drill prompts are different questions: no two share both prompt and choices.
  const keys = decoding.map(q => `${q.question}|${[...q.choices].sort().join(',')}`);
  expect(new Set(keys).size).toBe(52);
  expect(decoding.filter(q => q.question === 'Which word has a vowel team?')).toHaveLength(4);
  expect(new Set(decoding.map(q => q.correctIndex)).size).toBe(4);
});

test('Topic: offered per grade; a topic plays only its items, still paced; All is unchanged', () => {
  expect(gradeTopics('K')).toEqual(['all', 'sight-words']);
  for (const g of ['1', '2', '3', '4', '5'] as const) expect(gradeTopics(g)).toEqual(['all', 'decoding']);
  expect(topicFor('3', 'sight-words')).toBe('all'); // a remembered topic the grade lacks falls back to All
  expect(topicFor('K', 'sight-words')).toBe('sight-words');
  expect(topicFor('K', 'bogus')).toBe('all');
  for (const grade of grades) for (const date of ['2026-09-17', '2026-10-18', FRIDAY, '2027-01-15', '2027-05-01']) {
    expect(eligible(grade, 'Mixed Academic', 'mixed', date, 'all')).toEqual(eligible(grade, 'Mixed Academic', 'mixed', date));
    for (const topic of gradeTopics(grade).filter(t => t !== 'all')) {
      const both = eligible(grade, 'Mixed Academic', 'mixed', date, topic);
      expect(both.every(q => q.topic === topic && questionTaughtDate(q)! <= date)).toBe(true);
      // The subject mix does not apply to a topic game.
      expect(eligible(grade, 'Science', 'mixed', date, topic)).toEqual(both);
      const current = eligible(grade, 'Mixed Academic', 'current', date, topic), rev = eligible(grade, 'Mixed Academic', 'review', date, topic);
      expect(current.length + rev.length).toBe(both.length);
      expect(both.length).toBe(pacedCorners.filter(q => q.grade === grade && (q as { topic?: string }).topic === topic && questionTaughtDate(q as never)! <= date).length);
    }
  }
  expect(eligible('3', 'Mixed Academic', 'mixed', FRIDAY, 'decoding')).toHaveLength(10);
  expect(eligible('3', 'Mixed Academic', 'mixed', '2026-11-19', 'decoding')).toHaveLength(0);
  expect(eligible('1', 'Mixed Academic', 'mixed', FRIDAY, 'decoding').map(q => q.batchItemId).sort()).toEqual(['1-dc-1', '1-dc-2', '1-dc-3', '1-dc-4']);
});

test('Quick Check Topic: only that topic’s Four Corners items; starting a topic over keeps the rest of the grade’s history', () => {
  expect(pool('2', FRIDAY, {}, 'all')).toEqual(pool('2', FRIDAY, {}));
  const k = pool('K', FRIDAY, {}, 'sight-words');
  expect(k.length).toBeGreaterThan(40);
  expect(k.every(q => q.bank === 'four-corners' && q.spokenTarget)).toBe(true);
  const dc = pool('3', FRIDAY, {}, 'decoding');
  expect(dc.map(q => q.id).sort()).toEqual(decoding.filter(q => q.grade === '3').map(q => q.id).sort());
  // A grade's All history survives a topic game that runs out and starts over.
  const other = pool('3', FRIDAY, {}).filter(q => !dc.some(d => d.id === q.id)).slice(0, 3).map(q => q.id);
  let s = begin({ ...quickFresh(), asOf: FRIDAY, grade: '3', topic: 'decoding', seen: { '3': [...other, ...dc.map(q => q.id)] } }, dc, 'qc-topic', `${FRIDAY}T16:00:00.000Z`);
  expect(s.seen['3']).toEqual(expect.arrayContaining(other));
  while (!s.exhausted) s = next(reveal(s), dc);
  s = startOver(s, dc);
  expect(s.seen['3']).toEqual(expect.arrayContaining(other));
  expect(isQuickState(s)).toBe(true);
  expect(isQuickState({ ...s, topic: 'phonics' })).toBe(false);
  expect(toSetup(s).topic).toBe('decoding'); // remembered for the next game
});

for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720]]) test(`Four Corners Topic setup at ${width}×${height}: Decoding plays only decoding, says when short, is remembered, and fits`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.goto('/games/four-corners');
  await page.getByRole('button', { name: 'Classic Mode', exact: true }).click();
  // Kindergarten offers Sight Words; grades 1–5 offer Decoding.
  await expect(page.getByRole('button', { name: 'Sight Words', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Decoding', exact: true })).toHaveCount(0);
  expect(await fits(page)).toBe(true);
  await page.getByRole('button', { name: '3rd Grade', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sight Words', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Decoding', exact: true }).click();
  await expect(page.getByText('10 eligible unique questions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Science', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^15 rounds/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^15 rounds/ })).toContainText('Needs 5 more questions');
  await expect(page.getByText('Decoding has 10 questions for 3rd Grade so far; 15 are needed. Choose fewer rounds or Topic All.')).toBeVisible();
  expect(await fits(page)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Decoding', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '10 rounds', exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), CORNER_KEY);
  expect(saved.topic).toBe('decoding');
  expect([...saved.questionIds].sort()).toEqual(decoding.filter(q => q.grade === '3').map(q => q.id).sort());
  await page.reload();
  await expect(page.locator('.fc-game h1')).toHaveText(decoding.find(q => q.id === saved.questionIds[0])!.question);
  // Back in setup the topic is kept; a grade without it falls back to All.
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change Grade', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Decoding', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: labels.K, exact: true }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Science', exact: true })).toBeEnabled();
});

test('Four Corners Topic: a short topic says so plainly', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T12:00:00-05:00'));
  await page.goto('/games/four-corners');
  await page.getByRole('button', { name: '3rd Grade', exact: true }).click();
  await page.getByRole('button', { name: 'Decoding', exact: true }).click();
  await expect(page.getByText('0 eligible unique questions')).toBeVisible();
  await expect(page.getByText('Decoding has 0 questions for 3rd Grade so far; 1 is needed. Choose fewer rounds or Topic All.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start Game/ })).toBeDisabled();
});

for (const [width, height] of [[1920, 1080], [1280, 720]]) test(`Quick Check Topic at ${width}×${height}: Sight Words plays only sight words, is remembered, and setup fits with 8 teams`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(new Date(`${FRIDAY}T12:00:00-05:00`));
  await page.goto('/games/quick-check');
  await expect(page.getByRole('button', { name: 'Sight Words', exact: true })).toHaveCount(0); // no grade yet
  await page.getByRole('button', { name: 'Kindergarten', exact: true }).click();
  await page.getByRole('button', { name: '8 teams', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Sight Words', exact: true }).click();
  expect(await fits(page)).toBe(true);
  await page.getByRole('button', { name: 'Grade 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Decoding', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Kindergarten', exact: true }).click();
  await page.getByRole('button', { name: 'Sight Words', exact: true }).click();
  await page.getByRole('button', { name: 'Start →' }).click();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), QUICK_CHECK_KEY);
  expect(state.topic).toBe('sight-words');
  expect([...state.asked, ...state.queue].every((q: { spokenTarget?: string }) => q.spokenTarget)).toBe(true);
  await expect(page.locator('.qc-listen')).toBeVisible();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await page.getByRole('button', { name: 'New Quick Check' }).click();
  await expect(page.getByRole('button', { name: 'Sight Words', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
