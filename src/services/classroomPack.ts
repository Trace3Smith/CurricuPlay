import rawPack from '../data/tomorrow-pack.json';
import { bank, validateQuestions } from './questionEngine';
import { effectiveQuestion, type Decisions } from './questionReview';
import type { Question } from '../types';
export const PACK_NAME = 'DCSS Tomorrow Classroom Pack - 2026-09-14';
export const PACK_CUTOFF = '2026-09-13';
export const classroomBank = validateQuestions(rawPack);
// Pack acceptance is a separate, explicitly authorized release decision. It never
// changes draft review status or writes into the teacher's local review storage.
export function classroomQuestions(decisions: Decisions, source?: 'classroom' | 'drafts'): Question[] {
  if (source === 'drafts' || (!rawPack.length && !classroomBank.errors.length)) return bank.questions.map(q => effectiveQuestion(q, decisions));
  if (classroomBank.errors.length) return [];
  return classroomBank.questions.filter(q => q.weekIntroduced <= PACK_CUTOFF && (q.alignedWeeks ?? []).every(w => w <= PACK_CUTOFF)).map(q => {
    const prior = q.originId ? decisions[q.originId] : undefined;
    // Never override a teacher veto on content reused from a reviewed draft.
    if (prior && ['rejected', 'needs-edit'].includes(prior.status)) return { ...q, reviewStatus: prior.status };
    return effectiveQuestion(q, decisions);
  });
}
