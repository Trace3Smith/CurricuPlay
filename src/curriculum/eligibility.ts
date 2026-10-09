import { grades, type Grade } from '../types';

export const INITIAL_CUTOFF = '2026-10-09';
export const SCHOOL_TIMEZONE = 'America/New_York';
export const contentModes = ['current', 'previous', 'mixed', 'general'] as const;
export type ContentMode = typeof contentModes[number];
export interface InstructionPeriod { start: string; end: string }
/** A schedule is evidence of planned instruction, never completion or mastery. */
export interface CurriculumEvidence {
  grade: Grade; subject: string; target: string; source: string; sourceUrl: string;
  locator: string; unit: string; earliestEligible: string | null;
  periods: InstructionPeriod[];
  category: 'source-listed' | 'skill-practice' | 'general';
  timing: 'documented' | 'unknown' | 'conflicting';
  review: 'approved' | 'pending';
  note: string;
}
export interface CurriculumSelection { grade: Grade; cutoff: string; mode: ContentMode; priorGrade: boolean }
export function validSchoolDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function schoolDate(now = new Date(), timeZone = SCHOOL_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function isEvidence(value: unknown): value is CurriculumEvidence {
  if (!value || typeof value !== 'object') return false;
  const e = value as CurriculumEvidence;
  const text = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 500;
  return grades.includes(e.grade) && [e.subject, e.target, e.source, e.locator, e.unit, e.note].every(text) &&
    typeof e.sourceUrl === 'string' && (e.sourceUrl === '' || /^https:\/\//.test(e.sourceUrl)) &&
    ['source-listed', 'skill-practice', 'general'].includes(e.category) && ['documented', 'unknown', 'conflicting'].includes(e.timing) &&
    ['approved', 'pending'].includes(e.review) && (e.earliestEligible === null || validSchoolDate(e.earliestEligible)) &&
    Array.isArray(e.periods) && e.periods.every(p => p && typeof p === 'object' && validSchoolDate(p.start) && validSchoolDate(p.end) && p.start <= p.end) &&
    (e.timing !== 'documented' || (e.category !== 'general' && !!e.earliestEligible && e.periods.length > 0 &&
      e.periods.some(p => p.start <= e.earliestEligible! && p.end >= e.earliestEligible!)));
}
export function eligible(e: CurriculumEvidence | undefined, cutoff: string): boolean {
  return !!e && isEvidence(e) && validSchoolDate(cutoff) && e.review === 'approved' && e.category !== 'general' &&
    e.timing === 'documented' && !!e.earliestEligible && e.earliestEligible <= cutoff;
}
export function currentPeriod(cutoff: string): InstructionPeriod | null {
  if (!validSchoolDate(cutoff)) return null;
  const d = new Date(`${cutoff}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 4);
  return { start, end: d.toISOString().slice(0, 10) };
}
export function classification(e: CurriculumEvidence, selection: CurriculumSelection): 'current' | 'earlier' | 'prior-grade' | null {
  if (!eligible(e, selection.cutoff)) return null;
  const rank = grades.indexOf(selection.grade), sourceRank = grades.indexOf(e.grade);
  if (sourceRank !== rank) return rank >= 2 && selection.priorGrade && sourceRank === rank - 1 ? 'prior-grade' : null;
  const period = currentPeriod(selection.cutoff)!;
  return e.periods.some(p => p.start <= period.end && p.end >= period.start && p.start <= selection.cutoff) ? 'current' : 'earlier';
}
/** Deterministic, balanced round-robin selection; games may shuffle its result. */
export function selectCurriculum<T extends { id: string; grade: Grade; curriculum?: CurriculumEvidence }>(items: readonly T[], s: CurriculumSelection): T[] {
  if (!validSchoolDate(s.cutoff) || !grades.includes(s.grade) || !contentModes.includes(s.mode)) return [];
  if (s.mode === 'general') return items.filter(w => w.grade === s.grade && (!w.curriculum || w.curriculum.category === 'general'));
  const groups: T[][] = [[], [], []];
  for (const w of items) {
    if (!w.curriculum || w.curriculum.grade !== w.grade) continue;
    const kind = classification(w.curriculum, s);
    if (kind === 'current') groups[0].push(w);
    if (kind === 'earlier') groups[1].push(w);
    if (kind === 'prior-grade') groups[2].push(w);
  }
  if (s.mode === 'current') return groups[0];
  if (s.mode === 'previous') return groups[1];
  // Retain the entire pool for class-length play; balance each three-item block where possible.
  return Array.from({ length: Math.max(...groups.map(g => g.length)) }, (_, i) => groups.flatMap(g => g[i] ? [g[i]] : [])).flat();
}
