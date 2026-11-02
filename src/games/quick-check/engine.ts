import { commitQuestion, createSession, endSession, isGameSession, type AssessmentTeam, type GameSession } from '../../assessment/engine';
import { classroomQuestions } from '../../services/classroomPack';
import { createQuestionEngine, familyOf, questionTaughtDate } from '../../services/questionEngine';
import { readReviews, type Decisions } from '../../services/questionReview';
import { validDate } from '../../services/curriculumService';
import { bank as cornerBank, eligible as cornerPool, type CornerQuestion } from '../four-corners/engine';
import { teamColors } from '../four-corners/teams';
import { schoolDate } from '../../curriculum/eligibility';
import { fridayOf } from '../../curriculum/pacing';
import { grades, subjects, type Grade, type Subject } from '../../types';

/**
 * Quick Check: a short end-of-class review from the approved Jeopardy and Four Corners banks.
 * Same pacing as Jeopardy (Current + Review on the teaching date, never before a question is taught).
 * No new content: every question is an existing approved bank question.
 */
import { QUICK_CHECK_KEY } from './keys';
export { QUICK_CHECK_KEY };
export const counts = [5, 10] as const;
export type QuestionCount = typeof counts[number];
export const MIN_TEAMS = 2, MAX_TEAMS = 8, NAME_LIMIT = 16;
// Teams 1–6 are the shared ClassThread team colors; 7 and 8 match State Lingo Bingo's Pink and Aqua.
export const quickTeamColors = [...teamColors, { name: 'Pink', accent: '#f472b6' }, { name: 'Aqua', accent: '#22d3ee' }];
/** Grades whose questions get a "Read it to me" button when the browser can speak. */
export const readAloudGrades: readonly Grade[] = ['K', '1', '2'];

export interface QuickQuestion {
  id: string; bank: 'jeopardy' | 'four-corners'; subject: Subject; standard: string | null;
  question: string; answer: string; taught: string;
  choices?: string[]; correctIndex?: number; explanation?: string; visual?: { src: string; alt: string };
}
export interface QuickState {
  version: 1; screen: 'setup' | 'play' | 'complete';
  grade: Grade | null; count: QuestionCount; teamCount: number; names: string[]; // teamCount 0 = Teams Off; names[i] '' = color name
  asOf: string;
  questions: QuickQuestion[]; index: number; revealed: boolean; marks: Record<string, string[]>;
  sessionId?: string; startedAt?: string; endedAt?: string; teams?: AssessmentTeam[];
  /** Questions already used per grade, so games avoid repeats until that grade's bank runs out. */
  seen: Partial<Record<Grade, string[]>>;
}
export const freshState = (): QuickState => ({ version: 1, screen: 'setup', grade: null, count: 5, teamCount: 0, names: Array(MAX_TEAMS).fill(''), asOf: schoolDate(), questions: [], index: 0, revealed: false, marks: {}, seen: {} });

export const teamDefaultName = (i: number) => quickTeamColors[i].name;
export function createTeams(count: number, names: readonly string[]): AssessmentTeam[] {
  return Array.from({ length: count }, (_, i) => ({ id: `team-${i + 1}`, name: names[i]?.trim() || teamDefaultName(i), accent: quickTeamColors[i].accent }));
}

/** Monday of the school week containing `date`. */
const mondayOf = (date: string) => { const d = new Date(`${fridayOf(date)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 4); return d.toISOString().slice(0, 10); };

/** Approved, unvetoed Jeopardy and Four Corners questions for the grade that are taught by the teaching date. */
export function pool(grade: Grade, asOf: string, decisions: Decisions = readReviews().decisions): QuickQuestion[] {
  const jeopardy = createQuestionEngine(classroomQuestions(decisions)).getQuestions({ grade, range: 'mixed', asOf, unused: false });
  const corners = cornerPool(grade, 'Mixed Academic', 'mixed', asOf);
  const out: QuickQuestion[] = [];
  for (const q of jeopardy) out.push({ id: q.id, bank: 'jeopardy', subject: q.subject, standard: q.standard, question: q.question, answer: q.answer, taught: questionTaughtDate(q)! });
  for (const q of corners as CornerQuestion[]) out.push({ id: q.id, bank: 'four-corners', subject: q.subject, standard: q.standard, question: q.question, answer: q.answer, taught: questionTaughtDate(q)!,
    choices: [...q.choices], correctIndex: q.correctIndex, ...(q.explanation ? { explanation: q.explanation } : {}), ...(q.visual ? { visual: { src: q.visual.src, alt: q.visual.alt } } : {}) });
  // Belt and braces: the engines already exclude untaught content.
  return out.filter(q => q.taught && q.taught <= asOf);
}
/** A Four Corners question made from a Jeopardy question (and template variants) is the same question for repeats. */
const families = (() => {
  let map: Map<string, string> | undefined;
  return (id: string) => {
    map ??= new Map([...classroomQuestions({}).map(q => [q.id, familyOf(q)] as const)]);
    return map.get(id) ?? id;
  };
})();
function familyKey(q: QuickQuestion, cornerOrigins: Map<string, string>) {
  return families(cornerOrigins.get(q.id) ?? q.id);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

/**
 * Pick `count` questions: about 60% taught this school week, the rest review (earlier Current and Review),
 * each side filling from the other when short. Unseen questions come first; once the grade's unseen
 * questions run out, a new cycle starts. One question per family per game.
 */
export function selectQuestions(available: QuickQuestion[], count: number, seen: readonly string[], asOf: string, random = Math.random, origins = cornerOrigins()): { questions: QuickQuestion[]; seen: string[] } {
  const weekStart = mondayOf(asOf);
  const seenSet = new Set(seen);
  const unseen = available.filter(q => !seenSet.has(q.id)), repeats = available.filter(q => seenSet.has(q.id));
  const picked: QuickQuestion[] = [], usedFamilies = new Set<string>();
  const take = (from: QuickQuestion[], n: number) => {
    for (const q of shuffle(from, random)) {
      if (picked.length >= count || n <= 0) return;
      const family = familyKey(q, origins);
      if (usedFamilies.has(family) || picked.includes(q)) continue;
      usedFamilies.add(family); picked.push(q); n--;
    }
  };
  const fill = (from: QuickQuestion[]) => {
    const week = from.filter(q => q.taught >= weekStart), older = from.filter(q => q.taught < weekStart);
    const weekTarget = Math.ceil(count * .6);
    take(week, weekTarget - picked.length);
    take(older, count - picked.length);
    take(week, count - picked.length);
  };
  fill(unseen);
  const ranOut = picked.length < count;
  if (ranOut) fill(repeats);
  const questions = shuffle(picked, random);
  // When the bank ran out, the next cycle starts with this game's questions.
  return { questions, seen: ranOut ? questions.map(q => q.id) : [...seen, ...questions.map(q => q.id)] };
}
/** Four Corners conversions name their Jeopardy parent question. */
export function cornerOrigins(): Map<string, string> {
  const map = new Map<string, string>();
  for (const q of cornerBank) { const origin = q.originId ?? q.adaptation?.sourceQuestionId; if (origin) map.set(q.id, origin); }
  return map;
}

export function begin(s: QuickState, questions: QuickQuestion[], seen: string[], id: string, now: string): QuickState {
  if (!s.grade || !questions.length) return s;
  return { ...s, screen: 'play', questions, index: 0, revealed: false, marks: {}, sessionId: id, startedAt: now, endedAt: undefined,
    teams: s.teamCount ? createTeams(s.teamCount, s.names) : [], seen: { ...s.seen, [s.grade]: seen } };
}
export const reveal = (s: QuickState): QuickState => s.screen === 'play' ? { ...s, revealed: true } : s;
/** One tap marks a team correct for the current question; a second tap clears it. Only after Reveal. */
export function toggleTeam(s: QuickState, teamId: string): QuickState {
  const q = s.questions[s.index];
  if (s.screen !== 'play' || !s.revealed || !q || !s.teams?.some(t => t.id === teamId)) return s;
  const ids = s.marks[q.id] ?? [];
  return { ...s, marks: { ...s.marks, [q.id]: ids.includes(teamId) ? ids.filter(id => id !== teamId) : [...ids, teamId] } };
}
export function next(s: QuickState, now: string): QuickState {
  if (s.screen !== 'play' || !s.revealed) return s;
  if (s.index === s.questions.length - 1) return { ...s, screen: 'complete', endedAt: now };
  return { ...s, index: s.index + 1, revealed: false };
}
/** Back steps the flow backwards: hide the answer, or return to the previous (revealed) question. Marks are kept. */
export function back(s: QuickState): QuickState {
  if (s.screen !== 'play') return s;
  if (s.revealed) return { ...s, revealed: false };
  return s.index > 0 ? { ...s, index: s.index - 1, revealed: true } : s;
}
export const scores = (s: QuickState) => (s.teams ?? []).map(t => ({ ...t, score: s.questions.filter(q => (s.marks[q.id] ?? []).includes(t.id)).length }));
/** Every team with the top score (ties allowed); none when teams are off. */
export function winners(s: QuickState) {
  const all = scores(s), top = Math.max(0, ...all.map(t => t.score));
  return all.filter(t => t.score === top);
}

/** The finished game as a shared assessment session ("Quick Check" in Session History). */
export function toSession(s: QuickState): GameSession | null {
  if (s.screen !== 'complete' || !s.sessionId || !s.startedAt || !s.endedAt || !s.grade) return null;
  const teams = s.teams ?? [];
  let session = createSession({ id: s.sessionId, gameType: 'quick-check', grade: s.grade, mode: teams.length ? 'team' : 'classic', teams, startedAt: s.startedAt });
  for (const q of s.questions) session = commitQuestion(session, { questionId: q.id, subject: q.subject, prompt: q.question, ...(q.standard ? { standards: [q.standard] } : {}) },
    teams.map(t => { const correct = (s.marks[q.id] ?? []).includes(t.id); return { teamId: t.id, correct, pointsAwarded: correct ? 1 : 0 }; }), s.endedAt);
  return endSession(session, s.endedAt);
}

const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
function isQuestion(q: unknown): q is QuickQuestion {
  const x = q as QuickQuestion;
  return !!x && text(x.id) && (x.bank === 'jeopardy' || x.bank === 'four-corners') && subjects.includes(x.subject) && text(x.question) && text(x.answer) && validDate(x.taught) &&
    (x.standard === null || text(x.standard)) &&
    (x.choices === undefined || (Array.isArray(x.choices) && x.choices.length === 4 && x.choices.every(text) && Number.isInteger(x.correctIndex) && x.correctIndex! >= 0 && x.correctIndex! < 4));
}
export function isQuickState(v: unknown): v is QuickState {
  const s = v as QuickState;
  if (!s || s.version !== 1 || !['setup', 'play', 'complete'].includes(s.screen) || (s.grade !== null && !grades.includes(s.grade)) || !counts.includes(s.count) ||
    !Number.isInteger(s.teamCount) || (s.teamCount !== 0 && (s.teamCount < MIN_TEAMS || s.teamCount > MAX_TEAMS)) ||
    !Array.isArray(s.names) || s.names.length !== MAX_TEAMS || !s.names.every(n => typeof n === 'string' && n.length <= NAME_LIMIT) || !validDate(s.asOf) ||
    !Array.isArray(s.questions) || !s.questions.every(isQuestion) || new Set(s.questions.map(q => q.id)).size !== s.questions.length ||
    !Number.isInteger(s.index) || typeof s.revealed !== 'boolean' || !s.marks || typeof s.marks !== 'object' || !s.seen || typeof s.seen !== 'object') return false;
  if (!Object.entries(s.seen).every(([g, ids]) => grades.includes(g as Grade) && Array.isArray(ids) && ids.every(text))) return false;
  if (s.screen === 'setup') return true;
  const teams = s.teams ?? [];
  if (!s.grade || !s.questions.length || s.index < 0 || s.index >= s.questions.length || !text(s.sessionId) || !text(s.startedAt) || teams.length !== s.teamCount) return false;
  if (!Object.entries(s.marks).every(([id, ids]) => s.questions.some(q => q.id === id) && Array.isArray(ids) && ids.every(t => teams.some(team => team.id === t)) && new Set(ids).size === ids.length)) return false;
  if (s.screen === 'complete') { try { const session = toSession(s); return s.index === s.questions.length - 1 && !!session && isGameSession(session); } catch { return false; } }
  return true;
}
export function loadState(store: Pick<Storage, 'getItem'> = localStorage): QuickState {
  try {
    const s = JSON.parse(store.getItem(QUICK_CHECK_KEY) || 'null');
    if (!isQuickState(s)) return freshState();
    // Setup always starts from today; a game in progress keeps its own teaching date.
    return s.screen === 'setup' ? { ...s, asOf: schoolDate() } : s;
  } catch { return freshState(); }
}
export function saveState(s: QuickState, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(QUICK_CHECK_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
/** Back to setup with the same choices; question history is kept. */
export const toSetup = (s: QuickState): QuickState => ({ ...freshState(), grade: s.grade, count: s.count, teamCount: s.teamCount, names: s.names, seen: s.seen });

