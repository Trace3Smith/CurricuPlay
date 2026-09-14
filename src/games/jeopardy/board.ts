import { subjects, type Category } from '../../types';
export const categories: Category[] = [...subjects, 'Review'];
// Six opportunities per category; repeated values share the same 1/2/3 difficulty pools.
// Stable tile IDs preserve saved classroom games. Review shares question IDs with all subjects.
export const tiles = categories.flatMap(category => [1, 2, 3, 1, 2, 3].map((difficulty, row) => ({ id: `${category}-${row}`, category, difficulty })));

import { createQuestionEngine } from '../../services/questionEngine';
import type { Filters, Question } from '../../types';
export function isBoardEligible(assignments: unknown, questions: Question[], filters: Filters): boolean {
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) return false;
  const ids = assignments as Record<string, unknown>;
  if (Object.keys(ids).length !== tiles.length || new Set(Object.values(ids)).size !== tiles.length) return false;
  const engine = createQuestionEngine(questions);
  return tiles.every(t => typeof ids[t.id] === 'string' && engine.getQuestions({ ...filters, subject: t.category, difficulty: t.difficulty, unused: false }).some(q => q.id === ids[t.id]));
}
