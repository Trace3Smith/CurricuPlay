import { commitQuestion, createSession, endSession, isGameSession, type GameSession } from '../../assessment/engine';
import { createCornerTeams } from '../four-corners/teams';
import { difficulties, nextHintIndex, validateWords, type Difficulty, type WordEntry } from './words';
import { grades, type Grade } from '../../types';

export interface BeeState {
  version: 1; screen: 'play' | 'complete'; grade: Grade; difficulty: Difficulty;
  words: WordEntry[]; index: number; revealed: boolean; correctTeamIds: string[]; session: GameSession;
  extraLetters?: number[]; // Optional for compatibility with existing v1 saves.
}
export function beginGame(words: WordEntry[], grade: Grade, difficulty: Difficulty, id: string, now: string, random = Math.random): BeeState | null {
  if (validateWords(words).errors.length || !grades.includes(grade) || !difficulties.includes(difficulty)) return null;
  const pool = [...new Map(words.filter(w => w.grade === grade && w.reviewStatus === 'approved').map(w => [w.word, w])).values()];
  if (!pool.length) return null;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { version: 1, screen: 'play', grade, difficulty, words: pool.map(w => ({ ...w })), index: 0, revealed: false, correctTeamIds: [], extraLetters: [],
    session: createSession({ id, gameType: 'spelling-bee', grade, mode: 'team', teams: createCornerTeams(6), startedAt: now }) };
}
export const committed = (s: BeeState) => s.session.questions.some(q => q.questionId === s.words[s.index].id);
export function toggleTeam(s: BeeState, id: string): BeeState {
  if (s.screen !== 'play' || committed(s) || !s.session.teams.some(t => t.id === id)) return s;
  return { ...s, correctTeamIds: s.correctTeamIds.includes(id) ? s.correctTeamIds.filter(t => t !== id) : [...s.correctTeamIds, id] };
}
export function reveal(s: BeeState): BeeState { return s.screen === 'play' ? { ...s, revealed: true } : s; }
export function revealAnotherLetter(s: BeeState): BeeState {
  if (s.screen !== 'play' || s.revealed) return s;
  const index = nextHintIndex(s.words[s.index].word, s.difficulty, s.extraLetters);
  return index === undefined ? s : { ...s, extraLetters: [...(s.extraLetters ?? []), index] };
}
export function commitResults(s: BeeState, now: string): BeeState {
  if (s.screen !== 'play' || committed(s)) return s;
  const w = s.words[s.index];
  const session = commitQuestion(s.session, { questionId: w.id, subject: 'Spelling', concept: w.skill, prompt: `${w.word.toUpperCase()} — ${w.clue}` },
    s.session.teams.map(t => ({ teamId: t.id, correct: s.correctTeamIds.includes(t.id), pointsAwarded: s.correctTeamIds.includes(t.id) ? 1 : 0 })), now);
  return { ...s, session };
}
export function nextWord(s: BeeState, now: string): BeeState {
  if (s.screen !== 'play' || !committed(s)) return s;
  if (s.index === s.words.length - 1) return finishGame(s, now);
  return { ...s, index: s.index + 1, revealed: false, correctTeamIds: [], extraLetters: [] };
}
export function finishGame(s: BeeState, now: string): BeeState {
  return s.screen === 'complete' ? s : { ...s, screen: 'complete', session: endSession(s.session, now) };
}
export function isBeeState(value: unknown): value is BeeState {
  try {
    const s = value as BeeState;
    if (!s || s.version !== 1 || !['play', 'complete'].includes(s.screen) || !grades.includes(s.grade) || !difficulties.includes(s.difficulty) ||
      validateWords(s.words).errors.length || !s.words.length || s.words.some(w => w.grade !== s.grade || w.reviewStatus !== 'approved') ||
      !Number.isInteger(s.index) || s.index < 0 || s.index >= s.words.length || typeof s.revealed !== 'boolean' || !isGameSession(s.session)) return false;
    const length = s.words[s.index].word.length;
    if (s.extraLetters !== undefined && (!Array.isArray(s.extraLetters) || new Set(s.extraLetters).size !== s.extraLetters.length ||
      s.extraLetters.some(i => !Number.isInteger(i) || i < 0 || i >= length || i === Math.floor(length / 2)))) return false;
    const a = s.session;
    if (a.gameType !== 'spelling-bee' || a.mode !== 'team' || a.grade !== s.grade || !!a.endedAt !== (s.screen === 'complete') ||
      JSON.stringify(a.teams) !== JSON.stringify(createCornerTeams(6)) || !Array.isArray(s.correctTeamIds) ||
      new Set(s.correctTeamIds).size !== s.correctTeamIds.length || s.correctTeamIds.some(id => !a.teams.some(t => t.id === id))) return false;
    const count = a.questions.length;
    if (count < s.index || count > s.index + 1 || a.responses.length !== count * 6) return false;
    if (a.questions.some((q, i) => q.questionId !== s.words[i].id || q.subject !== 'Spelling' || q.concept !== s.words[i].skill || q.prompt !== `${s.words[i].word.toUpperCase()} — ${s.words[i].clue}`)) return false;
    if (a.responses.some(r => r.pointsAwarded !== (r.correct ? 1 : 0))) return false;
    return !committed(s) || a.responses.filter(r => r.questionId === s.words[s.index].id).every(r => r.correct === s.correctTeamIds.includes(r.teamId));
  } catch { return false; }
}
