import rawQuestions from '../data/questions.json' with { type: 'json' };
import { grades, subjects, type Filters, type PacedRange, type Question } from '../types';
import { inRange, recentStart, validDate } from './curriculumService';
import { pacingStatus, weeksTaughtDate } from '../curriculum/pacing';
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
      (q.reviewQuestion !== undefined && typeof q.reviewQuestion !== 'boolean') || (q.teacherRead !== undefined && typeof q.teacherRead !== 'boolean') ||
      (q.taughtOn !== undefined && !weeksTaughtDate(q.alignedWeeks ?? [q.weekIntroduced], q.taughtOn))) {
      errors.push(`Invalid or duplicate question at row ${index + 1}.`); return;
    }
    ids.add(q.id); questions.push(q as Question);
  });
  // Fail closed: a malformed bank must be corrected before classroom use.
  return { questions: errors.length ? [] : questions, errors };
}
export const bank = validateQuestions(rawQuestions);
// Template variants and their parent question are one family: a board may use at most one of them,
// and coverage counts the family once however many variants it has.
export const familyOf = (q: Question) => q.templateParentId ?? q.id;
export const isPaced = (range: Filters['range']): range is PacedRange => range === 'current' || range === 'review' || range === 'mixed';
export const questionTaughtDate = (q: Question) => weeksTaughtDate(q.alignedWeeks ?? [q.weekIntroduced], q.taughtOn);
/** Current/Review on the teaching date (which may be later than today when planning ahead); null while untaught. */
export const questionStatus = (q: Question, asOf: string) => pacingStatus(questionTaughtDate(q), asOf);
export function createQuestionEngine(questions: Question[], usedIds: string[] = []) {
  const used = new Set(usedIds);
  const getQuestions = (f: Filters) => {
    return questions.filter(q => {
      if (q.requiresExternalClassroomMaterial !== false || !(q.reviewStatus === 'approved' || (q.reviewStatus === undefined && !q.evidence)) || q.grade !== f.grade ||
        (f.difficulty && q.difficulty !== f.difficulty) || (f.unused !== false && used.has(q.id))) return false;
      if (isPaced(f.range)) {
        // A Review category draws on the Review pool plus already-taught questions marked for review.
        const status = questionStatus(q, f.asOf);
        return !!status && (f.range === 'mixed' || status === f.range) &&
          (!f.subject || (f.subject === 'Review' ? status === 'review' || q.reviewQuestion === true : q.subject === f.subject));
      }
      return inRange(q.weekIntroduced, 'all', f.asOf) && (q.alignedWeeks ?? [q.weekIntroduced]).some(week => inRange(week, f.range as 'recent' | 'all', f.asOf)) &&
        (!f.subject || (f.subject === 'Review' ? q.reviewQuestion === true || q.weekIntroduced < recentStart(f.asOf) : q.subject === f.subject));
    });
  };
  const shuffle = <T,>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  };
  // Match question families to requested slots without double-counting shared pools.
  // Augmenting paths let a flexible Review slot yield a scarce family to a subject slot.
  // Slots with a fallback fill from their primary pool first and use the fallback only where needed.
  function planQuestions(slots: { id: string; filters: Filters; fallback?: Filters }[], randomize = false) {
    const group = (f: Filters | undefined) => {
      const byFamily = new Map<string, string[]>();
      if (f) getQuestions(f).forEach(q => byFamily.set(familyOf(q), [...(byFamily.get(familyOf(q)) ?? []), q.id]));
      return byFamily;
    };
    const primary = slots.map(slot => group(slot.filters)), backup = slots.map(slot => group(slot.fallback));
    const members = primary.map((byFamily, i) => { const all = new Map(backup[i]); byFamily.forEach((ids, family) => all.set(family, ids)); return all; });
    const order = (keys: string[]) => randomize ? shuffle(keys) : keys;
    const pools = primary.map(byFamily => order([...byFamily.keys()]));
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
    // Widen unfilled slots to their fallback first, so filled slots keep their primary families;
    // only if the board is still incomplete may any slot use its fallback. Retrying every free slot
    // against the final pools keeps the matching maximum.
    const widen = (only?: Set<number>) => {
      slots.forEach((_, i) => { if (!only || only.has(i)) pools[i] = [...pools[i], ...order([...backup[i].keys()].filter(f => !primary[i].has(f) && !pools[i].includes(f)))]; });
      const matched = new Set(owners.values());
      slots.forEach((_, index) => { if (!matched.has(index)) match(index, new Set()); });
    };
    if (owners.size < slots.length && backup.some(b => b.size)) widen(new Set(slots.map((_, i) => i).filter(i => ![...owners.values()].includes(i))));
    if (owners.size < slots.length && backup.some(b => b.size)) widen();
    const assignments: Record<string, string> = {};
    owners.forEach((index, family) => {
      const ids = members[index].get(family)!;
      assignments[slots[index].id] = randomize ? ids[Math.floor(Math.random() * ids.length)] : ids[0];
    });
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
