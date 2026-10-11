import { freshTimer, isRoundTimer, timerFinished, advanceTimer, endTimer, startTimer, pauseTimer, timerDurations, type RoundTimer } from './timer';
import { commitQuestion, createSession, endSession, isGameSession, type GameSession } from '../../assessment/engine';
import { createCornerTeams } from '../four-corners/teams';
import { eligible, classification, contentModes, validSchoolDate, type CurriculumSelection } from '../../curriculum/eligibility';
import { answerFor, isWord, startingHints, difficulties, nextHintIndex, validateWords, type Difficulty, type WordEntry } from './words';
import { grades, type Grade } from '../../types';

export interface BeeState {
  version: 1 | 2; screen: 'play' | 'complete'; grade: Grade; difficulty: Difficulty;
  words: WordEntry[]; index: number; revealed: boolean; correctTeamIds: string[]; session: GameSession;
  flow?: { selection: CurriculumSelection; untilStop: boolean; cycle: number; order: string[]; offset: number; generalApproved: boolean; choices: 0 | 2 | 3 };
  timer?: RoundTimer; // Absent in historical v1/v2 sessions.
  extraLetters?: number[]; // Optional for compatibility with existing v1 saves.
}
export function beginGame(words: WordEntry[], grade: Grade, difficulty: Difficulty, id: string, now: string, random = Math.random, options?: StartOptions): BeeState | null {
  if (options) return beginPacedGame(words, grade, difficulty, id, now, random, options);
  if (validateWords(words).errors.length || !grades.includes(grade) || !difficulties.includes(difficulty)) return null;
  const pool = [...new Map(words.filter(w => w.grade === grade && w.reviewStatus === 'approved').map(w => [w.word, w])).values()];
  if (!pool.length) return null;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { version: 1, screen: 'play', grade, difficulty, words: pool.map(w => ({ ...w })), index: 0, revealed: false, correctTeamIds: [], extraLetters: [], ...(grade === 'K' ? {} : { timer: freshTimer() }),
    session: createSession({ id, gameType: 'spelling-bee', grade, mode: 'team', teams: createCornerTeams(6), startedAt: now }) };
}
export const currentWord = (s: BeeState): WordEntry => s.flow ? s.words.find(w => w.id === s.flow!.order[s.index])! : s.words[s.index];
export const questionId = (s: BeeState) => s.flow ? `${s.flow.cycle}::${currentWord(s).id}` : currentWord(s).id;
export const committed = (s: BeeState) => s.session.questions.some(q => q.questionId === questionId(s));
export const remaining = (s: BeeState) => (s.flow?.order.length ?? s.words.length) - s.index - (committed(s) ? 1 : 0);
export const exhausted = (s: BeeState) => s.screen === 'play' && !!s.flow?.untilStop && remaining(s) === 0;
export const canScore = (s: BeeState, now = Date.now()) => s.grade === 'K' || !s.timer || timerFinished(s.timer, now);
export function toggleTeam(s: BeeState, id: string, now = Date.now()): BeeState {
  if (s.screen !== 'play' || committed(s) || !canScore(s, now) || !s.session.teams.some(t => t.id === id)) return s;
  return { ...s, correctTeamIds: s.correctTeamIds.includes(id) ? s.correctTeamIds.filter(t => t !== id) : [...s.correctTeamIds, id] };
}
export function reveal(s: BeeState): BeeState { return s.screen === 'play' ? { ...s, revealed: true } : s; }
export function revealAnotherLetter(s: BeeState): BeeState {
  if (s.screen !== 'play' || s.revealed) return s;
  const index = nextHintIndex(answerFor(currentWord(s)), s.difficulty, s.extraLetters);
  return index === undefined ? s : { ...s, extraLetters: [...(s.extraLetters ?? []), index] };
}
export function commitResults(s: BeeState, now: string): BeeState {
  if (s.screen !== 'play' || committed(s) || !canScore(s, Date.parse(now))) return s;
  const w = currentWord(s);
  const session = commitQuestion(s.session, { questionId: questionId(s), subject: 'Spelling', concept: w.skill, prompt: resultPrompt(w) },
    s.session.teams.map(t => ({ teamId: t.id, correct: s.correctTeamIds.includes(t.id), pointsAwarded: s.correctTeamIds.includes(t.id) ? 1 : 0 })), now);
  return { ...s, session, ...(s.timer ? { timer: advanceTimer(s.timer, Date.parse(now)) } : {}) };
}
export function nextWord(s: BeeState, now: string): BeeState {
  if (s.screen !== 'play' || !committed(s)) return s;
  if (s.index === (s.flow?.order.length ?? s.words.length) - 1) return s.flow?.untilStop ? s : finishGame(s, now);
  const next = { ...s, index: s.index + 1, revealed: false, correctTeamIds: [], extraLetters: [], timer: s.grade === 'K' ? undefined : freshTimer(s.timer?.duration) };
  return { ...next, extraLetters: startingHints(currentWord(next), next.difficulty) };
}
export function finishGame(s: BeeState, now: string): BeeState {
  return s.screen === 'complete' ? s : { ...s, screen: 'complete', session: endSession(s.session, now) };
}
export function isBeeState(value: unknown): value is BeeState {
  try {
    const s = value as BeeState;
    if (s?.timer !== undefined && !isRoundTimer(s.timer)) return false;
    if (s?.version === 2) return isPacedState(s);
    if (!s || s.flow !== undefined || s.version !== 1 || !['play', 'complete'].includes(s.screen) || !grades.includes(s.grade) || !difficulties.includes(s.difficulty) ||
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


export interface StartOptions { selection: CurriculumSelection; untilStop: boolean; reviewed: boolean; choices: 0 | 2 | 3 }
const resultPrompt = (w: WordEntry) => w.activity === 'initial' ? `${answerFor(w).toUpperCase()} — Beginning sound: ${w.word}` : `${w.word.toUpperCase()} — ${w.clue}`;
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1)))); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function validSelection(s: CurriculumSelection): boolean {
  return !!s && grades.includes(s.grade) && validSchoolDate(s.cutoff) && contentModes.includes(s.mode) && typeof s.priorGrade === 'boolean';
}
function permitted(w: WordEntry, s: CurriculumSelection, allowGeneral: boolean): boolean {
  const rank = grades.indexOf(s.grade);
  if (w.grade !== s.grade && !(rank >= 2 && s.priorGrade && grades.indexOf(w.grade) === rank - 1)) return false;
  return w.reviewStatus === 'approved' && (w.curriculum ? eligible(w.curriculum, s.cutoff) : allowGeneral && w.grade === s.grade);
}
function beginPacedGame(words: WordEntry[], grade: Grade, difficulty: Difficulty, id: string, now: string, random: () => number, options: StartOptions): BeeState | null {
  const sel = options.selection;
  if (!options.reviewed || !validSelection(sel) || sel.grade !== grade || !difficulties.includes(difficulty) || ![0, 2, 3].includes(options.choices) || typeof options.untilStop !== 'boolean' || validateWords(words).errors.length || !words.length ||
      words.some(w => !permitted(w, sel, sel.mode === 'general') || (w.curriculum && sel.mode === 'general') ||
        (sel.mode === 'current' && classification(w.curriculum!, sel) !== 'current') ||
        (sel.mode === 'previous' && classification(w.curriculum!, sel) !== 'earlier'))) return null;
  const pool = structuredClone(words);
  // Shuffle within strata and interleave them, keeping Current + Review balanced.
  const groups = sel.mode === 'mixed' ? ['current', 'earlier', 'prior-grade'].map(kind => shuffle(pool.filter(w => w.curriculum && classification(w.curriculum, sel) === kind), random)) : [shuffle(pool, random)];
  const order = Array.from({ length: Math.max(...groups.map(g => g.length)) }, (_, i) => groups.flatMap(g => g[i] ? [g[i].id] : [])).flat();
  const s: BeeState = { version: 2, screen: 'play', grade, difficulty, words: pool, index: 0, revealed: false, correctTeamIds: [], ...(grade === 'K' ? {} : { timer: freshTimer() }),
    flow: { selection: { ...sel }, untilStop: options.untilStop, cycle: 1, order, offset: 0, generalApproved: sel.mode === 'general', choices: options.choices },
    session: createSession({ id, gameType: 'spelling-bee', grade, mode: 'team', teams: createCornerTeams(6), startedAt: now }) };
  s.extraLetters = startingHints(currentWord(s), difficulty);
  return s;
}
/** Explicit teacher action only; occurrence IDs prevent duplicate points across cycles. */
export function repeatCycle(s: BeeState, random = Math.random): BeeState {
  if (!exhausted(s) || !s.flow) return s;
  const flow = { ...s.flow, cycle: s.flow.cycle + 1, offset: s.session.questions.length, order: shuffle(s.words.map(w => w.id), random) };
  const next = { ...s, flow, index: 0, revealed: false, correctTeamIds: [], extraLetters: [], timer: s.grade === 'K' ? undefined : freshTimer(s.timer?.duration) };
  return { ...next, extraLetters: startingHints(currentWord(next), s.difficulty) };
}
/** Add a reviewed selection at the SAME cutoff. No automatic expansion or future dates. */
export function extendGame(s: BeeState, words: WordEntry[], options: StartOptions, now: string, random = Math.random): BeeState {
  if (!exhausted(s) || !s.flow || options.selection.cutoff !== s.flow.selection.cutoff || options.selection.grade !== s.grade) return s;
  const candidate = beginPacedGame(words, s.grade, s.difficulty, 'validation', now, random, options);
  if (!candidate?.flow) return s;
  const additions = candidate.words.filter(w => !s.words.some(old => old.id === w.id || old.word === w.word));
  if (!additions.length || s.words.length + additions.length > 200) return s;
  const flow = { ...s.flow, selection: { ...s.flow.selection, priorGrade: s.flow.selection.priorGrade || options.selection.priorGrade },
    generalApproved: s.flow.generalApproved || options.selection.mode === 'general', order: [...s.flow.order, ...shuffle(additions.map(w => w.id), random)] };
  return nextWord({ ...s, flow, words: [...s.words, ...additions] }, now);
}
export function letterChoices(w: WordEntry, count: 0 | 2 | 3): string[] {
  if (!count || w.activity !== 'initial') return [];
  const answer = answerFor(w).toUpperCase();
  // Neutral ordering and plausible, non-confusable alternatives; no correctness styling.
  return [answer, ...['M', 'T', 'S', 'B', 'A'].filter(c => c !== answer).slice(0, count - 1)].sort();
}
function isPacedState(s: BeeState): boolean {
  const f = s.flow, a = s.session;
  if (!f || !validSelection(f.selection) || f.selection.grade !== s.grade || !['play', 'complete'].includes(s.screen) || !difficulties.includes(s.difficulty) ||
    typeof f.untilStop !== 'boolean' || typeof f.generalApproved !== 'boolean' || ![0, 2, 3].includes(f.choices) || !Number.isSafeInteger(f.cycle) || f.cycle < 1 ||
    !Number.isSafeInteger(f.offset) || f.offset < 0 || !Array.isArray(s.words) || !s.words.length || validateWords(s.words).errors.length ||
    s.words.some(w => !isWord(w) || !permitted(w, f.selection, f.generalApproved)) || !Array.isArray(f.order) || !f.order.length ||
    new Set(f.order).size !== f.order.length || f.order.some(id => !s.words.some(w => w.id === id)) ||
    !Number.isInteger(s.index) || s.index < 0 || s.index >= f.order.length || typeof s.revealed !== 'boolean' || !isGameSession(a)) return false;
  if (a.gameType !== 'spelling-bee' || a.mode !== 'team' || a.grade !== s.grade || !!a.endedAt !== (s.screen === 'complete') ||
    JSON.stringify(a.teams) !== JSON.stringify(createCornerTeams(6)) || !Array.isArray(s.correctTeamIds) || new Set(s.correctTeamIds).size !== s.correctTeamIds.length ||
    s.correctTeamIds.some(id => !a.teams.some(t => t.id === id))) return false;
  const length = answerFor(currentWord(s)).length;
  if (!Array.isArray(s.extraLetters) || new Set(s.extraLetters).size !== s.extraLetters.length || s.extraLetters.some(i => !Number.isInteger(i) || i < 0 || i >= length || i === Math.floor(length / 2))) return false;
  if (a.questions.length < f.offset + s.index || a.questions.length > f.offset + s.index + 1 || a.responses.length !== a.questions.length * 6) return false;
  if (a.questions.some((q, i) => {
    const [cycle, id, extra] = q.questionId.split('::'), n = Number(cycle), w = s.words.find(w => w.id === id);
    return extra !== undefined || !w || !Number.isInteger(n) || n < 1 || n > f.cycle || (i < f.offset ? n >= f.cycle : n !== f.cycle || id !== f.order[i - f.offset]) ||
      q.subject !== 'Spelling' || q.concept !== w.skill || q.prompt !== resultPrompt(w);
  })) return false;
  if (a.responses.some(r => r.pointsAwarded !== (r.correct ? 1 : 0))) return false;
  return !committed(s) || a.responses.filter(r => r.questionId === questionId(s)).every(r => r.correct === s.correctTeamIds.includes(r.teamId));
}

/** Teacher actions never commit answers or award points. Reset discards only draft marks. */
export function controlTimer(s: BeeState, action: 'start' | 'pause' | 'reset' | 'end' | 'tick', now = Date.now(), duration?: number): BeeState {
  if (s.grade === 'K' || s.screen !== 'play' || committed(s)) return s;
  const timer = s.timer ?? freshTimer();
  if (duration !== undefined && (timer.status !== 'ready' || !timerDurations.includes(duration))) return s;
  const next = duration !== undefined ? freshTimer(duration) : action === 'start' ? startTimer(timer, now) : action === 'pause' ? pauseTimer(timer, now) : action === 'end' ? endTimer(timer, now) : action === 'reset' ? freshTimer(timer.duration) : advanceTimer(timer, now);
  return next === timer ? s : { ...s, timer: next, ...(action === 'reset' ? { correctTeamIds: [] } : {}) };
}
