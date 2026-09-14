import rawQuestions from '../data/questions.json';
import { grades, subjects, type Filters, type Question } from '../types';
import { inRange, recentStart, validDate } from './curriculumService';
export function validateQuestions(data: unknown): { questions: Question[]; errors: string[] } {
  const errors: string[] = [], questions: Question[] = [], ids = new Set<string>();
  if (!Array.isArray(data)) return { questions, errors: ['Question bank must be an array.'] };
  data.forEach((q, index) => {
    if (!q || typeof q !== 'object' || !['id', 'question', 'answer', 'source'].every(key => typeof q[key] === 'string' && q[key].trim()) ||
      typeof q.requiresExternalClassroomMaterial !== 'boolean' ||
      (q.standard !== null && (typeof q.standard !== 'string' || !q.standard.trim())) ||
      (q.standard === null && !q.session) ||
      (q.evidence !== undefined && !['pending', 'approved', 'needs-edit', 'rejected'].includes(q.reviewStatus)) ||
      (q.reviewStatus !== undefined && !['pending', 'approved', 'needs-edit', 'rejected'].includes(q.reviewStatus)) ||
      (q.alignedWeeks !== undefined && (!Array.isArray(q.alignedWeeks) || !q.alignedWeeks.length || !q.alignedWeeks.every((w: unknown) => validDate(w) && w >= q.weekIntroduced) || !q.alignedWeeks.includes(q.weekIntroduced))) ||
      !grades.includes(q.grade) || !subjects.includes(q.subject) || ![1, 2, 3].includes(q.difficulty) || !validDate(q.weekIntroduced) || ids.has(q.id) ||
      (q.choices !== undefined && (!Array.isArray(q.choices) || q.choices.length > 4 || !q.choices.every((c: unknown) => typeof c === 'string' && c.trim()))) ||
      (q.reviewQuestion !== undefined && typeof q.reviewQuestion !== 'boolean') || (q.teacherRead !== undefined && typeof q.teacherRead !== 'boolean')) {
      errors.push(`Invalid or duplicate question at row ${index + 1}.`); return;
    }
    ids.add(q.id); questions.push(q as Question);
  });
  // Fail closed: a malformed bank must be corrected before classroom use.
  return { questions: errors.length ? [] : questions, errors };
}
export const bank = validateQuestions(rawQuestions);
export function createQuestionEngine(questions: Question[], usedIds: string[] = []) {
  const used = new Set(usedIds);
  const getQuestions = (f: Filters) => questions.filter(q => q.requiresExternalClassroomMaterial === false && (q.reviewStatus === 'approved' || (q.reviewStatus === undefined && !q.evidence)) && q.grade === f.grade && (!f.difficulty || q.difficulty === f.difficulty) &&
    inRange(q.weekIntroduced, 'all', f.asOf) && (q.alignedWeeks ?? [q.weekIntroduced]).some(week => inRange(week, f.range, f.asOf)) && (f.unused === false || !used.has(q.id)) &&
    (!f.subject || (f.subject === 'Review' ? q.reviewQuestion === true || q.weekIntroduced < recentStart(f.asOf) : q.subject === f.subject)));
  // Match reusable question IDs to requested slots without double-counting shared pools.
  // Augmenting paths let a flexible Review slot yield a scarce question to a subject slot.
  function planQuestions(slots: { id: string; filters: Filters }[], randomize = false) {
    const pools = slots.map(slot => {
      const pool = getQuestions(slot.filters).map(q => q.id);
      if (randomize) for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool;
    });
    const owners = new Map<string, number>();
    function match(index: number, seen: Set<string>): boolean {
      for (const id of pools[index]) {
        if (seen.has(id)) continue;
        seen.add(id);
        const previous = owners.get(id);
        if (previous === undefined || match(previous, seen)) { owners.set(id, index); return true; }
      }
      return false;
    }
    slots.forEach((_, index) => match(index, new Set()));
    const assignments: Record<string, string> = {};
    owners.forEach((index, id) => { assignments[slots[index].id] = id; });
    return { assignments, matched: owners.size, complete: owners.size === slots.length };
  }
  return {
    planQuestions,
    getQuestions,
    getRandomQuestion: (f: Filters) => { const pool = getQuestions(f); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined; },
    getAvailableQuestionCount: (f: Filters) => getQuestions(f).length,
    markQuestionUsed: (id: string) => { used.add(id); },
    isQuestionUsed: (id: string) => used.has(id),
    resetUsedQuestions: () => used.clear(),
  };
}
