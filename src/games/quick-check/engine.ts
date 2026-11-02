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
import { QUICK_CHECK_KEY } from './keys';

/**
 * Quick Check: an open-ended end-of-class review from the approved Jeopardy and Four Corners banks.
 * Same pacing as Jeopardy (Current + Review on the teaching date, never before a question is taught).
 * It asks this week's questions first, then review, without repeats, until the teacher taps End.
 * No new content: every question is an existing approved bank question.
 */
export { QUICK_CHECK_KEY };
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
/** A question as asked in a game. `key` is unique in the game: the id, or id~2, id~3… after the list starts over. */
export type AskedQuestion = QuickQuestion & { key: string };
export interface QuickState {
  version: 1; screen: 'setup' | 'play' | 'complete';
  grade: Grade | null; teamCount: number; names: string[]; // teamCount 0 = Teams Off; names[i] '' = color name
  asOf: string;
  asked: AskedQuestion[]; queue: QuickQuestion[]; pass: number;
  index: number; revealed: string[]; marks: Record<string, string[]>; // revealed and marks are by question key
  /** "That's every question for now!": every question in this pass has been asked. */
  exhausted: boolean;
  sessionId?: string; startedAt?: string; endedAt?: string; teams?: AssessmentTeam[];
  /** Question ids already used per grade, so games avoid repeats until that grade's bank runs out. */
  seen: Partial<Record<Grade, string[]>>;
}
export const freshState = (): QuickState => ({ version: 1, screen: 'setup', grade: null, teamCount: 0, names: Array(MAX_TEAMS).fill(''), asOf: schoolDate(), asked: [], queue: [], pass: 1, index: 0, revealed: [], marks: {}, exhausted: false, seen: {} });

export const teamDefaultName = (i: number) => quickTeamColors[i].name;
export function createTeams(count: number, names: readonly string[]): AssessmentTeam[] {
  return Array.from({ length: count }, (_, i) => ({ id: `team-${i + 1}`, name: names[i]?.trim() || teamDefaultName(i), accent: quickTeamColors[i].accent }));
}

/** Monday of the school week containing `date`. */
export const mondayOf = (date: string) => { const d = new Date(`${fridayOf(date)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 4); return d.toISOString().slice(0, 10); };

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

/** Four Corners conversions name their Jeopardy parent question. */
export function cornerOrigins(): Map<string, string> {
  const map = new Map<string, string>();
  for (const q of cornerBank) { const origin = q.originId ?? q.adaptation?.sourceQuestionId; if (origin) map.set(q.id, origin); }
  return map;
}
let familyMap: Map<string, string> | undefined, originMap: Map<string, string> | undefined;
/** A Four Corners question made from a Jeopardy question (and template variants) count as one question for repeats. */
export function familyKey(id: string): string {
  familyMap ??= new Map(classroomQuestions({}).map(q => [q.id, familyOf(q)] as const));
  originMap ??= cornerOrigins();
  const parent = originMap.get(id) ?? id;
  return familyMap.get(parent) ?? parent;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
/** Unseen questions, one per family: this school week's first, then review, each part shuffled. */
export function orderQueue(available: QuickQuestion[], seen: readonly string[], asOf: string, random = Math.random): QuickQuestion[] {
  const weekStart = mondayOf(asOf), seenSet = new Set(seen), families = new Set<string>(), queue: QuickQuestion[] = [];
  const unseen = available.filter(q => !seenSet.has(q.id));
  for (const q of [...shuffle(unseen.filter(q => q.taught >= weekStart), random), ...shuffle(unseen.filter(q => q.taught < weekStart), random)]) {
    const family = familyKey(q.id);
    if (!families.has(family)) { families.add(family); queue.push(q); }
  }
  return queue;
}
/** Asking a question uses up its whole family for the grade. */
function markSeen(s: QuickState, q: QuickQuestion, available: readonly QuickQuestion[]): QuickState['seen'] {
  const family = familyKey(q.id), ids = available.filter(a => familyKey(a.id) === family).map(a => a.id);
  const seen = s.seen[s.grade!] ?? [];
  return { ...s.seen, [s.grade!]: [...seen, ...[q.id, ...ids].filter((id, i, all) => !seen.includes(id) && all.indexOf(id) === i)] };
}
function ask(s: QuickState, available: readonly QuickQuestion[]): QuickState {
  const [q, ...queue] = s.queue;
  const asked: AskedQuestion = { ...q, key: s.pass === 1 ? q.id : `${q.id}~${s.pass}` };
  return { ...s, asked: [...s.asked, asked], queue, index: s.asked.length, exhausted: false, seen: markSeen(s, q, available) };
}

export function begin(s: QuickState, available: QuickQuestion[], id: string, now: string, random = Math.random): QuickState {
  if (!s.grade || !available.length) return s;
  let seen = s.seen[s.grade] ?? [], queue = orderQueue(available, seen, s.asOf, random);
  // Every question was used in earlier games: this game starts the list over.
  if (!queue.length) { seen = []; queue = orderQueue(available, seen, s.asOf, random); }
  const started: QuickState = { ...s, screen: 'play', asked: [], queue, pass: 1, index: 0, revealed: [], marks: {}, exhausted: false, sessionId: id, startedAt: now, endedAt: undefined,
    teams: s.teamCount ? createTeams(s.teamCount, s.names) : [], seen: { ...s.seen, [s.grade]: seen } };
  return ask(started, available);
}
export const current = (s: QuickState): AskedQuestion | undefined => s.screen === 'play' && !s.exhausted ? s.asked[s.index] : undefined;
export const isRevealed = (s: QuickState) => { const q = current(s); return !!q && s.revealed.includes(q.key); };
export function reveal(s: QuickState): QuickState {
  const q = current(s);
  return q && !s.revealed.includes(q.key) ? { ...s, revealed: [...s.revealed, q.key] } : s;
}
/** One tap marks a team correct for the current question; a second tap clears it. Only after Reveal. */
export function toggleTeam(s: QuickState, teamId: string): QuickState {
  const q = current(s);
  if (!q || !isRevealed(s) || !s.teams?.some(t => t.id === teamId)) return s;
  const ids = s.marks[q.key] ?? [];
  return { ...s, marks: { ...s.marks, [q.key]: ids.includes(teamId) ? ids.filter(id => id !== teamId) : [...ids, teamId] } };
}
/** Next after Reveal: forward through questions already asked (after Back), else the next new question, else "every question". */
export function next(s: QuickState, available: readonly QuickQuestion[]): QuickState {
  if (!isRevealed(s)) return s;
  if (s.index < s.asked.length - 1) return { ...s, index: s.index + 1 };
  return s.queue.length ? ask(s, available) : { ...s, exhausted: true };
}
/** After "That's every question for now!": a new pass over the grade's whole list, without repeats again. */
export function startOver(s: QuickState, available: QuickQuestion[], random = Math.random): QuickState {
  if (s.screen !== 'play' || !s.exhausted || !s.grade) return s;
  const queue = orderQueue(available, [], s.asOf, random);
  if (!queue.length) return s;
  return ask({ ...s, pass: s.pass + 1, queue, seen: { ...s.seen, [s.grade]: [] } }, available);
}
/** Back steps the flow backwards: leave "every question", hide the answer, or return to the previous question. Marks are kept. */
export function back(s: QuickState): QuickState {
  if (s.screen !== 'play') return s;
  if (s.exhausted) return { ...s, exhausted: false };
  const q = current(s)!;
  if (s.revealed.includes(q.key)) return { ...s, revealed: s.revealed.filter(k => k !== q.key) };
  return s.index > 0 ? { ...s, index: s.index - 1 } : s;
}
/** End at any time: every question asked so far goes to the end screen and Session History. */
export const end = (s: QuickState, now: string): QuickState => s.screen === 'play' ? { ...s, screen: 'complete', exhausted: false, endedAt: now } : s;
/** Undo an accidental End. Ending again replaces the saved history record (same session id). */
export const keepGoing = (s: QuickState): QuickState => s.screen === 'complete' ? { ...s, screen: 'play', endedAt: undefined } : s;

export const scores = (s: QuickState) => (s.teams ?? []).map(t => ({ ...t, score: s.asked.filter(q => (s.marks[q.key] ?? []).includes(t.id)).length }));
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
  for (const q of s.asked) session = commitQuestion(session, { questionId: q.key, subject: q.subject, prompt: q.question, ...(q.standard ? { standards: [q.standard] } : {}) },
    teams.map(t => { const correct = (s.marks[q.key] ?? []).includes(t.id); return { teamId: t.id, correct, pointsAwarded: correct ? 1 : 0 }; }), s.endedAt);
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
  if (!s || s.version !== 1 || !['setup', 'play', 'complete'].includes(s.screen) || (s.grade !== null && !grades.includes(s.grade)) ||
    !Number.isInteger(s.teamCount) || (s.teamCount !== 0 && (s.teamCount < MIN_TEAMS || s.teamCount > MAX_TEAMS)) ||
    !Array.isArray(s.names) || s.names.length !== MAX_TEAMS || !s.names.every(n => typeof n === 'string' && n.length <= NAME_LIMIT) || !validDate(s.asOf) ||
    !Array.isArray(s.asked) || !s.asked.every(q => isQuestion(q) && text(q.key)) || new Set(s.asked.map(q => q.key)).size !== s.asked.length ||
    !Array.isArray(s.queue) || !s.queue.every(isQuestion) || !Number.isInteger(s.pass) || s.pass < 1 || typeof s.exhausted !== 'boolean' ||
    !Number.isInteger(s.index) || !Array.isArray(s.revealed) || !s.revealed.every(k => s.asked.some(q => q.key === k)) ||
    !s.marks || typeof s.marks !== 'object' || !s.seen || typeof s.seen !== 'object') return false;
  if (!Object.entries(s.seen).every(([g, ids]) => grades.includes(g as Grade) && Array.isArray(ids) && ids.every(text))) return false;
  if (s.screen === 'setup') return true;
  const teams = s.teams ?? [];
  if (!s.grade || !s.asked.length || s.index < 0 || s.index >= s.asked.length || !text(s.sessionId) || !text(s.startedAt) || teams.length !== s.teamCount) return false;
  if (!Object.entries(s.marks).every(([key, ids]) => s.asked.some(q => q.key === key) && Array.isArray(ids) && ids.every(t => teams.some(team => team.id === t)) && new Set(ids).size === ids.length)) return false;
  if (s.screen === 'complete') { try { const session = toSession(s); return !!session && isGameSession(session); } catch { return false; } }
  return !s.endedAt;
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
export const toSetup = (s: QuickState): QuickState => ({ ...freshState(), grade: s.grade, teamCount: s.teamCount, names: s.names, seen: s.seen });
