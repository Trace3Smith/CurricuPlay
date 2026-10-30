import { commitQuestion, createSession, endSession, type AssessmentTeam, type GameSession } from '../../assessment/engine';
import { teamColors } from '../four-corners/teams';
import capitals from '../../data/state-capitals.json' with { type: 'json' };

/** General Practice: not on the district pacing guide, so every state is available on any date. */
export interface StateEntry { code: string; name: string; fips: string; capital: string; region: Region; source: string }
export const regions = ['Northeast', 'Midwest', 'South', 'West'] as const;
export type Region = typeof regions[number];
export const states = capitals.states as StateEntry[];
export const stateByCode = new Map(states.map(s => [s.code, s]));

/** Legacy only: games saved before grade was removed may still carry one. The content is the same for every grade. */
export const bingoGrades = ['3', '4', '5'] as const;
export type BingoGrade = typeof bingoGrades[number];
export const cardSizes = [4, 5] as const;
export type CardSize = typeof cardSizes[number];
export const squareModes = ['names', 'outline', 'location'] as const;
export type SquareMode = typeof squareModes[number];
export const MIN_TEAMS = 2, MAX_TEAMS = 10, NAME_LIMIT = 16, FITNESS_LIMIT = 40, ANSWER_LIMIT = 40;
/** 5×5 with 6 or fewer teams; 4×4 with 7 or more so squares stay readable. The teacher can change it. */
export const LARGE_CLASS_TEAMS = 7;
export const defaultSize = (teamCount: number): CardSize => teamCount >= LARGE_CLASS_TEAMS ? 4 : 5;
/** A 5×5 card has a free center, so it needs 24 states; a 4×4 card needs 16. */
export const statesNeeded = (size: CardSize) => size === 5 ? 24 : 16;
export const defaultFitness = ['Jog 2 laps', '10 lunges', '5 push-ups', '10 sit-ups', '25 jumping jacks', '10 squats'];
export interface Scoring { capital: number; line: number; blackout: number }
export const defaultScoring: Scoring = { capital: 1, line: 5, blackout: 20 };

// Teams 1–6 reuse the shared ClassThread colors; 7–10 are chosen for contrast on the dark board.
const extraColors = [
  { name: 'Pink', accent: '#f472b6' },
  { name: 'Aqua', accent: '#22d3ee' },
  { name: 'White', accent: '#f1f5f9' },
  { name: 'Tan', accent: '#d4a373' },
];
export const bingoColors = [...teamColors, ...extraColors].map(c => c.accent);
export const defaultTeamName = (i: number) => `Team ${i + 1}`;

export interface Settings {
  /** Legacy: kept only so older saves load; new games never set it. */
  grade?: BingoGrade;
  teamCount: number; size: CardSize; regions: Region[]; squareMode: SquareMode;
  scoring: Scoring; fitness: string[]; names: string[]; // names[i] is '' for the default name
}
// On a judged tile: `said` is the capital typed (absent for the ✓/✗ buttons); `by` is who entered it,
// the team on its card keyboard or the teacher (absent in older saves).
export type EnteredBy = 'team' | 'teacher';
export type BingoEvent = { kind: 'target' | 'correct' | 'wrong'; teamId: string; state: string; at: string; said?: string; by?: EnteredBy };
/** A team's current fitness-card exercise. While it is not done, the team's card is locked. `roll` counts rolls. */
export interface ExerciseRoll { exercise: number; done: boolean; roll: number }
/** An exercise a team finished (its fitness-card text at the time), for the results and the Session Report. */
export interface ExerciseRecord { teamId: string; exercise: number; label: string; at: string }
export interface BingoState {
  version: 1; screen: 'setup' | 'play' | 'complete'; settings: Settings;
  sessionId?: string; startedAt?: string; endedAt?: string;
  teams?: AssessmentTeam[]; cards?: Record<string, (string | null)[]>; events?: BingoEvent[];
  // Kept beside the scoring events (never in them), so replay, Undo and scoring are unchanged. Absent in older saves.
  exercises?: Record<string, ExerciseRoll>; exerciseLog?: ExerciseRecord[];
}
export const freshSettings = (): Settings => ({
  teamCount: 8, size: defaultSize(8), regions: [...regions], squareMode: 'names',
  scoring: { ...defaultScoring }, fitness: [...defaultFitness], names: Array(MAX_TEAMS).fill(''),
});
export const freshState = (settings = freshSettings()): BingoState => ({ version: 1, screen: 'setup', settings });

/** Trimmed, length-limited, and unique ignoring case. Blank means the default name. */
export function nameErrors(names: readonly string[], count: number): string[] {
  const shown = Array.from({ length: count }, (_, i) => names[i]?.trim() || defaultTeamName(i));
  return shown.flatMap((name, i) => [
    ...(names[i] && names[i].trim().length > NAME_LIMIT ? [`${defaultTeamName(i)}: names can be up to ${NAME_LIMIT} characters.`] : []),
    ...(shown.findIndex(n => n.toLowerCase() === name.toLowerCase()) !== i ? [`${defaultTeamName(i)}: “${name}” is already used by another team.`] : []),
  ]);
}
export const pool = (selected: readonly Region[]) => states.filter(s => selected.includes(s.region));
export function setupErrors(s: Settings): string[] {
  const available = pool(s.regions).length, needed = statesNeeded(s.size);
  return [
    ...(available < needed ? [`A ${s.size}×${s.size} card needs at least ${needed} states. The selected regions have ${available}.`] : []),
    ...(Object.values(s.scoring).some(v => !Number.isInteger(v) || v < 0 || v > 100) ? ['Scoring values must be whole numbers from 0 to 100.'] : []),
    ...(s.fitness.some(f => !f.trim() || f.length > FITNESS_LIMIT) ? [`Each fitness card line needs 1 to ${FITNESS_LIMIT} characters.`] : []),
    ...nameErrors(s.names, s.teamCount),
  ];
}
export function createTeams(s: Settings): AssessmentTeam[] {
  return Array.from({ length: s.teamCount }, (_, i) => ({ id: `team-${i + 1}`, name: s.names[i]?.trim() || defaultTeamName(i), accent: bingoColors[i] }));
}
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(random() * (i + 1))); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
/** Row-major squares of state codes; the 5×5 center is null (free). */
export function generateCard(size: CardSize, selected: readonly Region[], random = Math.random): (string | null)[] {
  const card: (string | null)[] = shuffle(pool(selected).map(s => s.code), random).slice(0, statesNeeded(size));
  if (card.length < statesNeeded(size)) throw new Error('Not enough states for this card size');
  if (size === 5) card.splice(12, 0, null);
  return card;
}
export function beginGame(settings: Settings, id: string, now: string, random = Math.random): BingoState | null {
  if (setupErrors(settings).length) return null;
  const { grade: _legacyGrade, ...rest } = settings;
  const s: Settings = { ...rest, names: settings.names.map(n => n.trim()), fitness: settings.fitness.map(f => f.trim()) };
  const teams = createTeams(s);
  return { version: 1, screen: 'play', settings: s, sessionId: id, startedAt: now, teams, events: [],
    cards: Object.fromEntries(teams.map(t => [t.id, generateCard(s.size, s.regions, random)])) };
}

export interface TeamProgress { target: string | null; marked: Set<string>; wrong: number; lines: number; blackout: boolean; score: number }
/** All lines on a card: rows, columns, then both diagonals, as square indexes. */
export function cardLines(size: number): number[][] {
  const range = Array.from({ length: size }, (_, i) => i);
  return [...range.map(r => range.map(c => r * size + c)), ...range.map(c => range.map(r => r * size + c)), range.map(i => i * size + i), range.map(i => i * size + size - 1 - i)];
}
export function completedLines(card: readonly (string | null)[], marked: ReadonlySet<string>): number[][] {
  const size = Math.round(Math.sqrt(card.length));
  return cardLines(size).filter(line => line.every(i => card[i] === null || marked.has(card[i]!)));
}
export const isBlackout = (card: readonly (string | null)[], marked: ReadonlySet<string>) => card.every(c => c === null || marked.has(c));
/** Points a correct tap earns: the capital, plus any lines and the blackout it completes. */
function correctPoints(card: readonly (string | null)[], before: ReadonlySet<string>, after: ReadonlySet<string>, scoring: Scoring): number {
  return scoring.capital + (completedLines(card, after).length - completedLines(card, before).length) * scoring.line + (isBlackout(card, after) && !isBlackout(card, before) ? scoring.blackout : 0);
}
export function progress(s: BingoState, teamId: string, events = s.events ?? []): TeamProgress {
  const card = s.cards?.[teamId] ?? [];
  const marked = new Set<string>();
  let target: string | null = null, wrong = 0, score = 0;
  for (const e of events) {
    if (e.teamId !== teamId) continue;
    if (e.kind === 'target') target = e.state;
    else if (e.kind === 'wrong') wrong++;
    else { const before = new Set(marked); marked.add(e.state); score += correctPoints(card, before, marked, s.settings.scoring); target = null; }
  }
  return { target, marked, wrong, lines: completedLines(card, marked).length, blackout: card.length > 0 && isBlackout(card, marked), score };
}

/** Teacher actions. Each one appends one event; Undo removes the last event. */
export function setTarget(s: BingoState, teamId: string, state: string, now: string): BingoState {
  if (s.screen !== 'play' || !s.cards?.[teamId]?.includes(state) || progress(s, teamId).marked.has(state)) return s;
  return { ...s, events: [...s.events!, { kind: 'target', teamId, state, at: now }] };
}
export function judge(s: BingoState, teamId: string, kind: 'correct' | 'wrong', now: string, said?: string, by?: EnteredBy): BingoState {
  const target = s.screen === 'play' ? progress(s, teamId).target : null, typed = said?.trim().slice(0, ANSWER_LIMIT);
  return target ? { ...s, events: [...s.events!, { kind, teamId, state: target, at: now, ...(typed ? { said: typed } : {}), ...(by ? { by } : {}) }] } : s;
}

/** Lenient capital check: ignores case, accents, spaces and punctuation, reads "St." as "Saint",
 *  and allows small misspellings (1 letter off from 5 letters, 2 letters off from 8). */
const simplify = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\bst\b/g, 'saint').replace(/\s+/g, '');
function lettersOff(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
export function capitalMatches(said: string, capital: string): boolean {
  const a = simplify(said), b = simplify(capital);
  if (!a) return false;
  if (a === b) return true;
  // Another state's capital, spelled right, is a wrong answer even when it is close (Columbus for Columbia).
  if (states.some(st => simplify(st.capital) === a)) return false;
  return lettersOff(a, b) <= (b.length >= 8 ? 2 : b.length >= 5 ? 1 : 0);
}
export function undo(s: BingoState): BingoState {
  if (s.screen !== 'play' || !s.events?.length) return s;
  const last = s.events.at(-1)!, roll = s.exercises?.[last.teamId];
  // Undoing a judged tile puts the team back where it was before the mark: card unlocked, state picked.
  const exercises = last.kind !== 'target' && roll && !roll.done ? { ...s.exercises, [last.teamId]: { ...roll, done: true } } : s.exercises;
  return { ...s, events: s.events.slice(0, -1), ...(exercises ? { exercises } : {}) };
}

/** Fitness-card exercises: each team gets its own random exercise; the card stays locked until the teacher taps Done. */
export const isLocked = (s: BingoState, teamId: string) => !!s.exercises?.[teamId] && !s.exercises[teamId].done && !progress(s, teamId).blackout;
/** Roll a new exercise for a team (a re-roll never repeats the one showing). A team with a full card gets none. */
export function rollExercise(s: BingoState, teamId: string, random = Math.random): BingoState {
  if (s.screen !== 'play' || !s.cards?.[teamId] || progress(s, teamId).blackout) return s;
  const current = s.exercises?.[teamId], choices = [0, 1, 2, 3, 4, 5].filter(i => !current || current.done || i !== current.exercise);
  const exercise = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  return { ...s, exercises: { ...s.exercises, [teamId]: { exercise, done: false, roll: (current?.roll ?? 0) + 1 } } };
}
export const rollAll = (s: BingoState, random = Math.random) => (s.teams ?? []).reduce((next, t) => rollExercise(next, t.id, random), s);
/** The team finished its exercise: unlock the card and record it. */
export function finishExercise(s: BingoState, teamId: string, now: string): BingoState {
  const current = s.exercises?.[teamId];
  if (s.screen !== 'play' || !current || current.done) return s;
  return { ...s, exercises: { ...s.exercises, [teamId]: { ...current, done: true } },
    exerciseLog: [...(s.exerciseLog ?? []), { teamId, exercise: current.exercise, label: s.settings.fitness[current.exercise], at: now }] };
}
export function endGame(s: BingoState, now: string): BingoState {
  return s.screen === 'play' ? { ...s, screen: 'complete', endedAt: now } : s;
}

/** Team practice records from the event log; one assessment item per correct or wrong tile. */
export function buildSession(s: BingoState): GameSession {
  // Older saves keep the grade they recorded; new games have none.
  let session = createSession({ id: s.sessionId!, gameType: 'state-lingo-bingo', ...(s.settings.grade ? { grade: s.settings.grade } : {}), mode: 'team', teams: s.teams!, startedAt: s.startedAt! });
  if (s.exerciseLog?.length) session = { ...session, activities: s.exerciseLog.map(e => ({ teamId: e.teamId, label: e.label, at: e.at })) };
  const marked = new Map(s.teams!.map(t => [t.id, new Set<string>()]));
  (s.events ?? []).forEach((e, i) => {
    if (e.kind === 'target') return;
    const state = stateByCode.get(e.state)!, before = marked.get(e.teamId)!, after = new Set(before);
    let points = 0;
    if (e.kind === 'correct') { after.add(e.state); points = correctPoints(s.cards![e.teamId], before, after, s.settings.scoring); marked.set(e.teamId, after); }
    session = commitQuestion(session, { questionId: `attempt-${i + 1}::${e.state}`, subject: 'States & Capitals', concept: state.name, prompt: `${state.name} — capital: ${state.capital}` },
      [{ teamId: e.teamId, correct: e.kind === 'correct', pointsAwarded: points, ...(e.said ? { said: e.said } : {}), ...(e.by ? { enteredBy: e.by } : {}) }], e.at);
  });
  return s.endedAt ? endSession(session, s.endedAt) : session;
}

export interface TypedAnswer { state: string; said?: string; correct: boolean; by?: EnteredBy }
export interface TeamReport { team: AssessmentTeam; score: number; correct: number; wrong: number; lines: number; blackout: boolean; missed: string[]; exercises: string[]; answers: TypedAnswer[] }
export interface ReviewItem { state: string; teamId: string; reason: 'missed' | 'slow'; seconds?: number }
export function report(s: BingoState): { teams: TeamReport[]; review: ReviewItem[] } {
  const events = s.events ?? [];
  const teams = s.teams!.map(team => {
    const p = progress(s, team.id), mine = events.filter(e => e.teamId === team.id);
    return { team, score: p.score, correct: p.marked.size, wrong: p.wrong, lines: p.lines, blackout: p.blackout, missed: [...new Set(mine.filter(e => e.kind === 'wrong').map(e => e.state))],
      exercises: (s.exerciseLog ?? []).filter(e => e.teamId === team.id).map(e => e.label),
      // Every tile with a typed answer or a known enterer (team keyboard or teacher), in order.
      answers: mine.filter(e => e.kind !== 'target' && (e.said || e.by)).map(e => ({ state: e.state, ...(e.said ? { said: e.said } : {}), correct: e.kind === 'correct', ...(e.by ? { by: e.by } : {}) })) };
  });
  // Time to find: from the target being set to the correct tap.
  const timed: ReviewItem[] = [];
  const setAt = new Map<string, string>();
  for (const e of events) {
    if (e.kind === 'target') setAt.set(e.teamId, e.at);
    else if (e.kind === 'correct' && setAt.has(e.teamId)) { timed.push({ state: e.state, teamId: e.teamId, reason: 'slow', seconds: Math.round((Date.parse(e.at) - Date.parse(setAt.get(e.teamId)!)) / 1000) }); setAt.delete(e.teamId); }
  }
  const missed = teams.flatMap(t => t.missed.map(state => ({ state, teamId: t.team.id, reason: 'missed' as const })));
  const slow = timed.sort((a, b) => b.seconds! - a.seconds!).slice(0, 5);
  return { teams, review: [...missed, ...slow] };
}

/** Board layout: [columns, rows] for each team count, per the design. */
export function boardLayout(count: number): [number, number] {
  return count <= 3 ? [count, 1] : count === 4 ? [2, 2] : count <= 6 ? [3, 2] : count <= 8 ? [4, 2] : [5, 2];
}

const text = (v: unknown): v is string => typeof v === 'string';
const time = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
function validSettings(s: Settings): boolean {
  return !!s && (s.grade === undefined || bingoGrades.includes(s.grade)) && Number.isInteger(s.teamCount) && s.teamCount >= MIN_TEAMS && s.teamCount <= MAX_TEAMS && cardSizes.includes(s.size) &&
    Array.isArray(s.regions) && s.regions.length > 0 && new Set(s.regions).size === s.regions.length && s.regions.every(r => regions.includes(r)) && squareModes.includes(s.squareMode) &&
    !!s.scoring && ['capital', 'line', 'blackout'].every(k => Number.isInteger(s.scoring[k as keyof Scoring])) &&
    Array.isArray(s.fitness) && s.fitness.length === 6 && s.fitness.every(text) && Array.isArray(s.names) && s.names.length === MAX_TEAMS && s.names.every(text);
}
const exerciseIndex = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 6;
/** Exercise state is optional (older saves have none) but must match the teams when present. */
function validExercises(s: BingoState): boolean {
  if (s.exercises !== undefined) {
    if (!s.exercises || typeof s.exercises !== 'object') return false;
    for (const [teamId, e] of Object.entries(s.exercises)) if (!s.cards![teamId] || !e || !exerciseIndex(e.exercise) || typeof e.done !== 'boolean' || !Number.isInteger(e.roll) || e.roll < 1) return false;
  }
  if (s.exerciseLog !== undefined) {
    if (!Array.isArray(s.exerciseLog)) return false;
    for (const e of s.exerciseLog) if (!e || !s.cards![e.teamId] || !exerciseIndex(e.exercise) || !text(e.label) || !time(e.at)) return false;
  }
  return true;
}
/** Validate a saved payload by replaying it; any inconsistency rejects the whole save. */
export function isBingoState(value: unknown): value is BingoState {
  try {
    const s = value as BingoState;
    if (!s || s.version !== 1 || !['setup', 'play', 'complete'].includes(s.screen) || !validSettings(s.settings)) return false;
    if (s.screen === 'setup') return s.events === undefined && s.cards === undefined && s.exercises === undefined && s.exerciseLog === undefined;
    if (setupErrors(s.settings).length || !text(s.sessionId) || !s.sessionId || !time(s.startedAt) || (s.screen === 'complete') !== time(s.endedAt) || (s.endedAt && Date.parse(s.endedAt) < Date.parse(s.startedAt))) return false;
    if (JSON.stringify(s.teams) !== JSON.stringify(createTeams(s.settings)) || !s.cards || Object.keys(s.cards).length !== s.teams!.length) return false;
    const allowed = new Set(pool(s.settings.regions).map(st => st.code)), length = s.settings.size ** 2;
    for (const t of s.teams!) {
      const card = s.cards[t.id];
      if (!Array.isArray(card) || card.length !== length) return false;
      const codes = card.filter((c, i) => (s.settings.size === 5 && i === 12) ? c !== null : true);
      if (codes.length !== statesNeeded(s.settings.size) || codes.some(c => !text(c) || !allowed.has(c)) || new Set(codes).size !== codes.length) return false;
      if (s.settings.size === 5 && card[12] !== null) return false;
    }
    if (!Array.isArray(s.events) || !validExercises(s)) return false;
    let replay: BingoState = { ...s, screen: 'play', events: [] }, last = Date.parse(s.startedAt!);
    const end = s.endedAt ? Date.parse(s.endedAt) : Infinity;
    for (const e of s.events) {
      if (!e || !['target', 'correct', 'wrong'].includes(e.kind) || !time(e.at) || Date.parse(e.at) < last || Date.parse(e.at) > end || !s.cards[e.teamId]) return false;
      if (e.said !== undefined && (e.kind === 'target' || !text(e.said) || !e.said.trim() || e.said !== e.said.trim() || e.said.length > ANSWER_LIMIT)) return false;
      if (e.by !== undefined && (e.kind === 'target' || (e.by !== 'team' && e.by !== 'teacher'))) return false;
      const next = e.kind === 'target' ? setTarget(replay, e.teamId, e.state, e.at) : progress(replay, e.teamId).target === e.state ? judge(replay, e.teamId, e.kind, e.at, e.said, e.by) : replay;
      if (next === replay) return false;
      replay = next; last = Date.parse(e.at);
    }
    return true;
  } catch { return false; }
}
