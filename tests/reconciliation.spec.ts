import { test, expect } from '@playwright/test';
// Isolate the long-term draft workflow from the independently tested classroom pack.
test.beforeEach(async ({ page }) => { await page.route("**/src/data/tomorrow-pack.json*", route => route.fulfill({ contentType: "application/javascript", body: "export default []" })); });

import questions from '../src/data/questions.json' with { type: 'json' };
import audit from '../content/material-audit.json' with { type: 'json' };
import { compareReview, effectiveQuestion, reconciliationSummary, type Decisions } from '../src/services/questionReview';
import type { Question } from '../src/types';
const grade = questions.filter(q => q.grade === '1') as Question[];
const originals = audit as Record<string, { original: unknown; resolution: string }>;
const decision = (q: Question, status: 'approved' | 'rejected' = 'approved') => ({ original: JSON.stringify(originals[q.id].original), status, question: (originals[q.id].original as Question).question, answer: (originals[q.id].original as Question).answer, reviewedAt: '2026-09-12T12:00:00Z' });
const unchanged = grade.filter(q => originals[q.id].resolution !== 'replaced');
const replacements = grade.filter(q => originals[q.id].resolution === 'replaced');
const saved: Decisions = Object.fromEntries(grade.map(q => [q.id, decision(q, q.id === unchanged[0].id ? 'rejected' : 'approved')]));

test('complete first-grade comparison preserves only identical prior human decisions', () => {
  expect(unchanged).toHaveLength(30); expect(replacements).toHaveLength(1);
  expect(reconciliationSummary(grade, saved)).toEqual({ approvalsSafelyPreserved: 29, contentChangedReReview: 0, newReplacementsRequiringReview: 1, previouslyRejectedRemainRejected: 1, noPreviousDecision: 0, needsAttention: 1 });
  for (const q of unchanged) expect(compareReview(q, saved).kind).toBe('metadata-only');
  for (const q of replacements) expect(effectiveQuestion(q, saved).reviewStatus).toBe('pending');
  expect(grade.filter(q => effectiveQuestion(q, saved).reviewStatus === 'approved')).toHaveLength(29);
  expect(reconciliationSummary(grade, {})).toMatchObject({ approvalsSafelyPreserved: 0, noPreviousDecision: 31, needsAttention: 31 });
});

test('wording, evidence, alignment, difficulty, timing and prior local edits cannot inherit approval', () => {
  const q = unchanged[1]; const d = decision(q);
  const mutations = { question: q.question + ' ', answer: q.answer + ' ', subject: 'Math', difficulty: q.difficulty === 1 ? 2 : 1, grade: '5', standard: 'changed', session: 'changed', unit: 'changed', curriculumIds: ['different'], alignedWeeks: ['2026-10-12'], weekIntroduced: '2026-10-12', evidence: { ...q.evidence, quote: 'different' }, source: 'different', sourceUrl: 'https://example.com', teacherRead: !q.teacherRead, choices: ['different'], reviewQuestion: !q.reviewQuestion, materialReviewNote: 'Changed caveat', requiresExternalClassroomMaterial: true };
  for (const [field, value] of Object.entries(mutations)) {
    if (JSON.stringify(value) === JSON.stringify(q[field as keyof Question])) continue;
    const changed = { ...q, [field]: value } as Question;
    expect(compareReview(changed, { [q.id]: d }).preserved, field).toBe(false);
    expect(effectiveQuestion(changed, { [q.id]: d }).reviewStatus, field).toBe('pending');
  }
  for (const field of ['question', 'answer'] as const) expect(compareReview(q, { [q.id]: { ...d, [field]: 'Previously edited text' } }).kind).toBe('content-changed');
  expect(compareReview(q, { [q.id]: { ...d, original: '{broken' } }).preserved).toBe(false);
  const externalOld = { ...JSON.parse(d.original), requiresExternalClassroomMaterial: true };
  expect(compareReview(q, { [q.id]: { ...d, original: JSON.stringify(externalOld) } }).preserved).toBe(false);
  const current = { ...d, original: JSON.stringify(q), question: 'Explicitly reviewed local edit' };
  expect(effectiveQuestion(q, { [q.id]: current }).question).toBe(current.question);
  expect(effectiveQuestion(replacements[0], { [replacements[0].id]: decision(replacements[0], 'rejected') }).reviewStatus).toBe('rejected');
});

test('attention queue, live counts, rejection filter and refresh use actual saved decisions without rewriting them', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  const stored = JSON.stringify({ version: 1, decisions: saved });
  await page.evaluate(value => localStorage.setItem('curricuplay.reviews.v1', value), stored);
  await page.goto('/#review'); await page.reload();
  await expect(page.getByLabel('Changes since human review')).toHaveValue('attention');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(1);
  const summary = page.getByRole('region', { name: 'Previous human decisions' });
  await expect(summary).toContainText('29 approvals safely preserved');
  await expect(summary).toContainText('1 new replacements requiring review');
  await expect(summary).toContainText('1 previously rejected remain rejected');
  expect(await page.evaluate(() => localStorage.getItem('curricuplay.reviews.v1'))).toBe(stored);
  await page.reload(); await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(1);
  await page.getByLabel('Changes since human review').selectOption('metadata-only');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(30);
  await page.getByLabel('Review status', { exact: true }).selectOption('rejected');
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Only questions needing attention', exact: true }).click();
  await page.getByRole('checkbox', { name: /Advance to next/ }).check();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByLabel('Jump to a draft').locator('option')).toHaveCount(0);
  await expect(summary).toContainText('30 approvals safely preserved');
  await page.screenshot({ path: 'test-results/reconciliation-1920.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
