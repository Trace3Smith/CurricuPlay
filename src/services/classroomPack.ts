import rawPack from '../data/tomorrow-pack.json' with { type: 'json' };
import { bank, validateQuestions } from './questionEngine';
import { effectiveQuestion, type Decisions } from './questionReview';
import type { Question } from '../types';
export const PACK_NAME = 'DCSS Tomorrow Classroom Pack - 2026-09-14';
export const classroomBank = validateQuestions(rawPack);
// Pack acceptance is a separate, explicitly authorized release decision. It never
// changes draft review status or writes into the teacher's local review storage.
export function classroomQuestions(decisions: Decisions, source?: 'classroom' | 'drafts'): Question[] {
  if (source === 'drafts' || (!rawPack.length && !classroomBank.errors.length)) return bank.questions.map(q => effectiveQuestion(q, decisions));
  if (classroomBank.errors.length) return [];
  // Timing is applied per teaching date by the question engine; a question never shows before it is taught.
  return classroomBank.questions.map(q => {
    const prior = q.originId ? decisions[q.originId] : undefined;
    // Never override a teacher veto on content reused from a reviewed draft.
    if (prior && ['rejected', 'needs-edit'].includes(prior.status)) return { ...q, reviewStatus: prior.status };
    return effectiveQuestion(q, decisions);
  });
}
