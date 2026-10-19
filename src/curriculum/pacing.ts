import { grades, type Grade } from '../types';
import { isEvidence, schoolDate, validSchoolDate, type CurriculumEvidence } from './eligibility';

/**
 * Rolling one-month pacing shared by every game. Dates are school-calendar days (YYYY-MM-DD);
 * a schedule is evidence of planned instruction, never completion or mastery.
 */
export type PacingStatus = 'current' | 'review';
export type PacedMode = 'current' | 'review' | 'mixed';
export interface PacedSelection { grade: Grade; today: string; mode: PacedMode; priorGrade: boolean }

const utc = (date: string) => new Date(`${date}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Calendar-month arithmetic that clamps to the last day of shorter months (Jan 31 + 1 → Feb 28). */
export function addMonths(date: string, months: number): string {
  const d = utc(date), day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}
function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
/** Friday of the Monday-based school week containing `date`. */
export function fridayOf(date: string): string {
  return addDays(date, 4 - (utc(date).getUTCDay() + 6) % 7);
}

/**
 * The day an item counts as taught: the exact day when evidence names one (a single-day period),
 * otherwise the Friday of the listed week, never earlier than the existing week-end eligibility date.
 * Unapproved, general, undated, unknown, or conflicting evidence has no taught date and is never shown.
 */
export function taughtDate(e: CurriculumEvidence | undefined): string | null {
  if (!e || !isEvidence(e) || e.review !== 'approved' || e.category === 'general' || e.timing !== 'documented' || !e.earliestEligible) return null;
  const eligibleOn = e.earliestEligible;
  const period = e.periods.find(p => p.start <= eligibleOn && p.end >= eligibleOn)!;
  if (period.start === period.end) return period.start;
  const friday = fridayOf(period.start);
  return friday > eligibleOn ? friday : eligibleOn;
}

/**
 * Taught date for week-scheduled content: the exact day when one is recorded, otherwise the Friday
 * of the latest listed week, so content spanning several weeks is never shown before all of it is taught.
 */
export function weeksTaughtDate(weeks: readonly string[], exactDay?: string): string | null {
  if (!weeks.length || !weeks.every(validSchoolDate)) return null;
  const last = [...weeks].sort().at(-1)!;
  if (exactDay !== undefined) return validSchoolDate(exactDay) && exactDay >= last ? exactDay : null;
  return fridayOf(last);
}

/** Hidden (null) before the taught date; Current for one calendar month; Review afterwards. */
export function pacingStatus(taught: string | null, today: string): PacingStatus | null {
  if (!taught || !validSchoolDate(today) || today < taught) return null;
  return today < addMonths(taught, 1) ? 'current' : 'review';
}

/** The taught dates that are Current on `today`, for teacher-facing explanations. */
export function currentWindow(today: string): { start: string; end: string } | null {
  if (!validSchoolDate(today)) return null;
  let start = addDays(today, -31);
  while (addMonths(start, 1) <= today) start = addDays(start, 1);
  return { start, end: today };
}

/** Teachers may plan with a later date; every game says so whenever the date is after today. */
export const PLANNING_AHEAD = 'Planning ahead: this includes content not taught yet.';
export const planningAhead = (date: string, today = schoolDate()) => validSchoolDate(date) && date > today;

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
export function shortDate(date: string): string {
  const d = utc(date);
  return `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function pacedKind(e: CurriculumEvidence | undefined, s: PacedSelection): PacingStatus | 'prior-grade' | null {
  const status = pacingStatus(taughtDate(e), s.today);
  if (!e || !status) return null;
  const rank = grades.indexOf(s.grade), sourceRank = grades.indexOf(e.grade);
  if (sourceRank === rank) return status;
  return rank >= 2 && s.priorGrade && sourceRank === rank - 1 ? 'prior-grade' : null;
}

/** Newest-taught first; ties keep their incoming order. */
export function newestFirst<T extends { curriculum?: CurriculumEvidence }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (taughtDate(b.curriculum) ?? '').localeCompare(taughtDate(a.curriculum) ?? ''));
}

/** Current is newest-taught first; Current + Review interleaves Current, Review, and Prior-Grade Review. */
export function selectPaced<T extends { grade: Grade; curriculum?: CurriculumEvidence }>(items: readonly T[], s: PacedSelection): T[] {
  if (!validSchoolDate(s.today) || !grades.includes(s.grade)) return [];
  const groups: T[][] = [[], [], []];
  for (const item of items) {
    if (!item.curriculum || item.curriculum.grade !== item.grade) continue;
    const kind = pacedKind(item.curriculum, s);
    if (kind === 'current') groups[0].push(item);
    if (kind === 'review') groups[1].push(item);
    if (kind === 'prior-grade') groups[2].push(item);
  }
  groups[0] = newestFirst(groups[0]);
  if (s.mode === 'current') return groups[0];
  if (s.mode === 'review') return groups[1];
  return Array.from({ length: Math.max(...groups.map(g => g.length)) }, (_, i) => groups.flatMap(g => g[i] ? [g[i]] : [])).flat();
}
