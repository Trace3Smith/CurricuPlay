import { movementDuration, type MovementDuration } from './movementTimer';
import { createCornerTeams } from './teams';
import { commitQuestion, createSession, endSession, isGameSession, type GameSession, type AssessmentQuestionSnapshot } from '../../assessment/engine';
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
  movementDuration?: MovementDuration;
  mode?: 'team' | 'classic'; teamCount?: number; session?: GameSession; correctTeamIds?: string[];
}
export const freshState = (): CornerState => ({ version: 1, screen: 'setup', grade: 'K', mix: 'Mixed Academic', rounds: 'all', mode: 'team', teamCount: 6, movementDuration: 10, currentRound: 0, questionIds: [], usedQuestionIds: [], revealed: false });
export function validSession(s: CornerState): boolean {
  const ids = new Set(eligible(s.grade, s.mix).map(q => q.id));
  const count = s.questionIds.length;
  const countValid = s.rounds === 'all' ? count > 0 && count === ids.size : count === s.rounds;
  const earlyValid = s.endedEarly === undefined || s.endedEarly === false || (s.endedEarly === true && s.screen === 'complete');
  return validAssessmentState(s) && countValid && earlyValid && new Set(s.questionIds).size === count && s.questionIds.every(id => ids.has(id)) && Number.isInteger(s.currentRound) && s.currentRound >= 0 && s.currentRound < count && s.usedQuestionIds.length === s.currentRound + 1 && s.usedQuestionIds.every((id, i) => id === s.questionIds[i]) && (s.screen !== 'complete' || s.endedEarly === true || (s.currentRound === count - 1 && s.revealed));
}
export function loadState(): CornerState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!s || s.version !== 1 || !grades.includes(s.grade) || !mixes.includes(s.mix) || !roundOptions.includes(s.rounds) || !['setup', 'play', 'complete'].includes(s.screen) || typeof s.revealed !== 'boolean' || !Array.isArray(s.questionIds) || !Array.isArray(s.usedQuestionIds)) return freshState();
    if (s.screen === 'setup' || !validSession(s)) return { ...freshState(), grade: s.grade, mix: s.mix, rounds: s.rounds, mode: s.mode === 'team' ? 'team' : 'classic', teamCount: validTeamCount(s.teamCount) ? s.teamCount : 6, movementDuration: movementDuration(s.movementDuration) };
    return s;
  } catch { return freshState(); }
}
export function saveState(state: CornerState): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export const validTeamCount = (count: unknown): count is number => typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 12;
export const isTeamMode = (s: CornerState) => s.mode === 'team';
export function questionSnapshot(q: CornerQuestion): AssessmentQuestionSnapshot {
  return { questionId: q.id, subject: q.subject, prompt: q.question, ...(q.standard ? { standards: [q.standard] } : {}) };
}
function validAssessmentState(s: CornerState): boolean {
  if (s.mode !== undefined && s.mode !== 'team' && s.mode !== 'classic') return false;
  if (s.teamCount !== undefined && !validTeamCount(s.teamCount)) return false;
  // Existing v1 Classic games have no assessment fields; preserve them without inventing responses.
  if (!s.session) return !isTeamMode(s) && s.correctTeamIds === undefined;
  if (!isGameSession(s.session) || s.session.gameType !== 'four-corners' || s.session.grade !== s.grade || s.session.mode !== (s.mode ?? 'classic')) return false;
  if (!!s.session.endedAt !== (s.screen === 'complete')) return false;
  const completed = s.screen === 'complete' && !s.endedEarly ? s.questionIds.length : s.currentRound;
  if (s.session.questions.length !== completed || s.session.questions.some((q, i) => q.questionId !== s.questionIds[i])) return false;
  const teams = isTeamMode(s) ? s.teamCount : 0;
  if (s.session.teams.length !== teams || s.session.responses.length !== completed * (teams ?? 0)) return false;
  if (s.session.responses.some(r => r.pointsAwarded !== (r.correct ? 1 : 0))) return false;
  const selected = s.correctTeamIds;
  return Array.isArray(selected) && new Set(selected).size === selected.length && selected.every(id => s.session!.teams.some(t => t.id === id)) && (s.revealed || selected.length === 0);
}
export function beginGame(s: CornerState, questionIds: string[], id: string, now: string): CornerState {
  const mode = s.mode ?? 'classic';
  const teams = mode === 'team' ? createCornerTeams(s.teamCount ?? 6) : [];
  return { ...s, mode, screen: 'play', questionIds, currentRound: 0, usedQuestionIds: [questionIds[0]], revealed: false, endedEarly: false, correctTeamIds: [], session: createSession({ id, gameType: 'four-corners', grade: s.grade, mode, teams, startedAt: now }) };
}
export function toggleCorrectTeam(s: CornerState, teamId: string): CornerState {
  if (s.screen !== 'play' || !s.revealed || !isTeamMode(s) || !s.session?.teams.some(t => t.id === teamId)) return s;
  const ids = s.correctTeamIds ?? [];
  return { ...s, correctTeamIds: ids.includes(teamId) ? ids.filter(id => id !== teamId) : [...ids, teamId] };
}
function sessionFor(s: CornerState, now: string): GameSession {
  if (s.session) return s.session;
  // Legacy Classic progress contains completed question IDs, but no team responses.
  let session = createSession({ id: crypto.randomUUID(), gameType: 'four-corners', grade: s.grade, mode: 'classic', teams: [], startedAt: now });
  for (const id of s.questionIds.slice(0, s.currentRound)) {
    const q = bank.find(q => q.id === id);
    if (q) session = commitQuestion(session, questionSnapshot(q), [], now);
  }
  return session;
}
export function advanceRound(s: CornerState, now: string): CornerState {
  if (s.screen !== 'play' || !s.revealed) return s;
  const q = bank.find(q => q.id === s.questionIds[s.currentRound]);
  if (!q) return s;
  const session = sessionFor(s, now);
  const committed = commitQuestion(session, questionSnapshot(q), session.teams.map(t => ({ teamId: t.id, correct: (s.correctTeamIds ?? []).includes(t.id), pointsAwarded: (s.correctTeamIds ?? []).includes(t.id) ? 1 : 0 })), now);
  if (s.currentRound === s.questionIds.length - 1) return { ...s, screen: 'complete', correctTeamIds: [], session: endSession(committed, now) };
  const currentRound = s.currentRound + 1;
  return { ...s, currentRound, revealed: false, correctTeamIds: [], session: committed, usedQuestionIds: s.questionIds.slice(0, currentRound + 1) };
}
/** Stop never commits the visible question, even if revealed or tentatively scored. */
export function finishEarly(s: CornerState, now: string): CornerState {
  if (s.screen !== 'play') return s;
  return { ...s, screen: 'complete', endedEarly: true, correctTeamIds: [], session: endSession(sessionFor(s, now), now) };
}
