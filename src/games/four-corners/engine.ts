import raw from '../../data/four-corners.json';
import { grades, type Grade, type Question } from '../../types';
import { createQuestionEngine, validateQuestions } from '../../services/questionEngine';
import { classroomQuestions, PACK_CUTOFF } from '../../services/classroomPack';
import { readReviews } from '../../services/questionReview';
import { localDate } from '../../services/curriculumService';

export const mixes = ['Mixed Academic', 'Science', 'Social Studies', 'Reading / ELA'] as const;
export type Mix = typeof mixes[number];
export const roundOptions = [10, 15, 20, 30, 'all'] as const;
export type RoundCount = typeof roundOptions[number];
export interface CornerQuestion extends Question {
  choices: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
  delivery?: 'look-at-print';
  adaptation?: { kind: 'conversion' | 'source-exercise'; sourceQuestionId?: string };
  visual?: { src: string; alt: string; kind?: 'illustration' | 'diagram' | 'photo' };
}
const validated = validateQuestions(raw);
export const bank: CornerQuestion[] = validated.errors.length ? [] : validated.questions.filter(q => {
  const c = q as CornerQuestion;
  return c.subject !== 'Math' && c.choices?.length === 4 && new Set(c.choices).size === 4 && Number.isInteger(c.correctIndex) && c.correctIndex >= 0 && c.correctIndex < 4 && c.choices[c.correctIndex] === c.answer && (!c.visual || (c.visual.src.startsWith('/four-corners/') && c.visual.alt.trim()));
}) as CornerQuestion[];
export const subjectLabel = (subject: string) => subject === 'Literacy' ? 'Reading / ELA' : subject;
export const gradeLabel = (g: Grade) => g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`;
export function eligible(grade: Grade, mix: Mix, asOf = localDate()): CornerQuestion[] {
  const decisions = readReviews().decisions;
  const parents = new Set(classroomQuestions(decisions).filter(q => q.reviewStatus === 'approved').map(q => q.id));
  const cutoff = asOf < PACK_CUTOFF ? asOf : PACK_CUTOFF;
  return createQuestionEngine(bank.filter(q => parents.has(q.originId!) && ![q.id, q.adaptation?.sourceQuestionId].some(id => id && ['rejected', 'needs-edit'].includes(decisions[id]?.status)) && (q.alignedWeeks ?? []).every(w => w <= cutoff))).getQuestions({ grade, range: 'all', asOf: cutoff, unused: false }).filter(q => mix === 'Mixed Academic' || subjectLabel(q.subject) === mix) as CornerQuestion[];
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
// Allocate one slot at a time to the least represented available subject. Then
// weave the allocated pools, avoiding consecutive repeats whenever possible.
export function buildQueue(pool: CornerQuestion[], rounds: number, random = Math.random): string[] {
  const unique = [...new Map(pool.map(q => [q.id, q])).values()];
  if (unique.length < rounds) return [];
  const groups = ['Science', 'Social Studies', 'Literacy'].map(subject => ({ subject, pool: shuffle(unique.filter(q => q.subject === subject), random), selected: [] as CornerQuestion[] }));
  for (let i = 0; i < rounds; i++) {
    const available = shuffle(groups.filter(g => g.pool.length), random).sort((a, b) => a.selected.length - b.selected.length);
    if (!available.length) return [];
    const group = available[0]; group.selected.push(group.pool.pop()!);
  }
  const queue: CornerQuestion[] = [];
  while (queue.length < rounds) {
    const available = groups.filter(g => g.selected.length);
    const different = available.filter(g => g.subject !== queue.at(-1)?.subject);
    const group = shuffle(different.length ? different : available, random).sort((a, b) => b.selected.length - a.selected.length)[0];
    queue.push(group.selected.pop()!);
  }
  return queue.map(q => q.id);
}
export const STORAGE_KEY = 'curricuplay.four-corners.v1';
export interface CornerState {
  version: 1; screen: 'setup' | 'play' | 'complete'; grade: Grade; mix: Mix; rounds: RoundCount; endedEarly?: boolean;
  currentRound: number; questionIds: string[]; usedQuestionIds: string[]; revealed: boolean;
}
export const freshState = (): CornerState => ({ version: 1, screen: 'setup', grade: 'K', mix: 'Mixed Academic', rounds: 15, currentRound: 0, questionIds: [], usedQuestionIds: [], revealed: false });
export function validSession(s: CornerState): boolean {
  const ids = new Set(eligible(s.grade, s.mix).map(q => q.id));
  const count = s.questionIds.length;
  const countValid = s.rounds === 'all' ? count > 0 && count === ids.size : count === s.rounds;
  const earlyValid = s.endedEarly === undefined || s.endedEarly === false || (s.endedEarly === true && s.rounds === 'all' && s.screen === 'complete');
  return countValid && earlyValid && new Set(s.questionIds).size === count && s.questionIds.every(id => ids.has(id)) && Number.isInteger(s.currentRound) && s.currentRound >= 0 && s.currentRound < count && s.usedQuestionIds.length === s.currentRound + 1 && s.usedQuestionIds.every((id, i) => id === s.questionIds[i]) && (s.screen !== 'complete' || s.endedEarly === true || (s.currentRound === count - 1 && s.revealed));
}
export function loadState(): CornerState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!s || s.version !== 1 || !grades.includes(s.grade) || !mixes.includes(s.mix) || !roundOptions.includes(s.rounds) || !['setup', 'play', 'complete'].includes(s.screen) || typeof s.revealed !== 'boolean' || !Array.isArray(s.questionIds) || !Array.isArray(s.usedQuestionIds)) return freshState();
    if (s.screen === 'setup' || !validSession(s)) return { ...freshState(), grade: s.grade, mix: s.mix, rounds: s.rounds };
    return s;
  } catch { return freshState(); }
}
export function saveState(state: CornerState): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
