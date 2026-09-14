import type { Question } from '../types';
import replacementIds from '../data/replacementQuestionIds.json' with { type: 'json' };
export type ReviewStatus = 'pending' | 'approved' | 'needs-edit' | 'rejected';
export interface Decision { original: string; status: ReviewStatus; question: string; answer: string; reviewedAt: string }
export type Decisions = Record<string, Decision>;
export const REVIEW_KEY = 'curricuplay.reviews.v1';
export function readReviews(): { decisions: Decisions; error: string } {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (!raw) return { decisions: {}, error: '' };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !data.decisions || typeof data.decisions !== 'object' || Array.isArray(data.decisions)) throw new Error();
    for (const d of Object.values(data.decisions) as Decision[]) {
      if (!d || !['pending', 'approved', 'needs-edit', 'rejected'].includes(d.status) ||
        !['original', 'question', 'answer', 'reviewedAt'].every(k => typeof d[k as keyof Decision] === 'string') ||
        (d.status === 'approved' && approvalError(d.question, d.answer))) throw new Error();
    }
    return { decisions: data.decisions, error: '' };
  } catch { return { decisions: {}, error: 'Local reviews could not be read. Local approvals are unavailable; check browser storage before reviewing.' }; }
}
export function approvalError(question: string, answer: string): string {
  if (!question.trim() || !answer.trim()) return 'A question and answer are required before approval.';
  if (question.trim().length > 240 || answer.trim().length > 300) return 'Keep the question within 240 characters and the answer within 300 for the Smart Board.';
  return '';
}
export const changeLabels = {
  'metadata-only': 'Only metadata changed — previous decision preserved',
  'content-changed': 'Content changed — re-review required',
  replacement: 'New replacement question — review required',
  current: 'Current human decision',
  unreviewed: 'No previous human decision found — review required',
};
export type ChangeKind = keyof typeof changeLabels;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
export function compareReview(q: Question, decisions: Decisions): { kind: ChangeKind; preserved: boolean; needsAttention: boolean; changedFields: string[] } {
  const d = decisions[q.id];
  const result = (kind: ChangeKind, preserved = false, changedFields: string[] = []) => ({ kind, preserved, changedFields, needsAttention: !preserved || d.status === 'pending' || d.status === 'needs-edit' });
  if (!d) return result(replacementIds.includes(q.id) ? 'replacement' : 'unreviewed');
  let old: Record<string, unknown>;
  try { old = JSON.parse(d.original); if (!old || typeof old !== 'object' || Array.isArray(old)) throw new Error(); }
  catch { return result('content-changed', false, ['Unreadable previous source snapshot']); }
  const now = q as unknown as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(old), ...Object.keys(now)])].filter(k => canonical(old[k]) !== canonical(now[k]));
  if (!changed.length) return result('current', true);
  // Allow only additions from the self-contained audit. Existing warnings, evidence,
  // alignment and even whitespace in question/answer text remain significant.
  const metadataOnly = changed.every(k => !Object.hasOwn(old, k) && (
    (k === 'requiresExternalClassroomMaterial' && now[k] === false) ||
    (k === 'materialReviewNote' && now[k] === 'Audited for self-contained gameplay. Teacher reading is allowed.')
  ));
  if (metadataOnly && d.question === q.question && d.answer === q.answer) return result('metadata-only', true, changed);
  const replacement = replacementIds.includes(q.id) && (old.question !== q.question || old.answer !== q.answer);
  return result(replacement ? 'replacement' : 'content-changed', false,
    [...changed, ...(d.question !== q.question ? ['Previously reviewed question wording differs'] : []), ...(d.answer !== q.answer ? ['Previously reviewed answer differs'] : [])]);
}
export function effectiveQuestion(q: Question, decisions: Decisions): Question {
  const d = decisions[q.id];
  if (!d) return q;
  // A rejection remains a conservative veto even when a replacement needs review.
  if (!compareReview(q, decisions).preserved) return { ...q, reviewStatus: d.status === 'rejected' ? 'rejected' : 'pending' };
  return { ...q, question: d.question, answer: d.answer, reviewStatus: d.status };
}
export function reconciliationSummary(questions: Question[], decisions: Decisions) {
  const compared = questions.map(q => ({ q, comparison: compareReview(q, decisions), d: decisions[q.id] }));
  return {
    approvalsSafelyPreserved: compared.filter(x => x.comparison.preserved && x.d?.status === 'approved').length,
    contentChangedReReview: compared.filter(x => x.comparison.kind === 'content-changed').length,
    newReplacementsRequiringReview: compared.filter(x => x.comparison.kind === 'replacement').length,
    previouslyRejectedRemainRejected: compared.filter(x => x.d?.status === 'rejected').length,
    noPreviousDecision: compared.filter(x => !x.d).length,
    needsAttention: compared.filter(x => x.comparison.needsAttention).length,
  };
}
export function writeReview(q: Question, status: ReviewStatus, question: string, answer: string, confirmsSelfContainedEdits = false): { decisions?: Decisions; error: string } {
  if (status === 'approved' && approvalError(question, answer)) return { error: approvalError(question, answer) };
  if (status === 'approved' && q.requiresExternalClassroomMaterial === false && (question.trim() !== q.question || answer.trim() !== q.answer) && !confirmsSelfContainedEdits) return { error: 'Confirm that your edited question contains all needed information and requires no external classroom resource.' };
  const current = readReviews();
  if (current.error) return { error: current.error };
  const decisions = { ...current.decisions, [q.id]: { original: JSON.stringify(q), status, question: question.trim(), answer: answer.trim(), reviewedAt: new Date().toISOString() } };
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify({ version: 1, decisions })); return { decisions, error: '' }; }
  catch { return { error: 'Review was not saved. Browser storage is unavailable or full. Your edits remain here; this decision has not been applied.' }; }
}
