import { commitQuestion, createSession, endSession, isGameSession, type AssessmentTeam, type GameSession } from '../../assessment/engine';
import { schoolDate } from '../../curriculum/eligibility';
import { fridayOf } from '../../curriculum/pacing';
import { validDate } from '../../services/curriculumService';
import { teamColors } from '../four-corners/teams';
import rawBank from '../../data/split-it-words.json' with { type: 'json' };
import { SPLIT_IT_KEY } from './keys';

/**
 * Split It!: a team at the Smart Board underlines every vowel, checks, reads the notes (silent e, vowel teams,
 * consonant + le, y), draws the syllable lines, checks, then hears each syllable and the whole word.
 * Words come from src/data/split-it-words.json (drawn from the live 2026-27-decoding batch). A word is playable
 * from its unlock date. Order, no-repeats, Back / End / Keep going and history follow Quick Check.
 */
export { SPLIT_IT_KEY };
export const splitGrades = ['1', '2', '3', '4', '5'] as const;
export type SplitGrade = typeof splitGrades[number];
export const MIN_TEAMS = 2, MAX_TEAMS = 8, NAME_LIMIT = 16;
export const exerciseDurations = [10, 15, 20] as const;
export type ExerciseDuration = typeof exerciseDurations[number];
// Teams 1–6 are the shared ClassThread team colours; 7 and 8 match Quick Check and State Lingo Bingo.
export const splitTeamColors = [...teamColors, { name: 'Pink', accent: '#f472b6' }, { name: 'Aqua', accent: '#22d3ee' }];

export interface SplitWord {
  grade: SplitGrade; word: string; split: string; splitAfterLetter: number[]; unlocks: string;
  underline: number[]; silentE: number[]; consonantLe: [number, number][]; vowelTeams: [number, number][]; yAsVowel: boolean;
}
export const wordId = (w: Pick<SplitWord, 'grade' | 'word'>) => `${w.grade}:${w.word}`;

const isVowelAt = (word: string, i: number) => 'aeiou'.includes(word[i].toLowerCase()) || (word[i].toLowerCase() === 'y' && i === word.length - 1);
const ints = (v: unknown): v is number[] => Array.isArray(v) && v.every(n => Number.isInteger(n));
const pairs = (v: unknown): v is [number, number][] => Array.isArray(v) && v.every(p => ints(p) && p.length === 2 && p[0] < p[1]);
/** Every bank entry must agree with itself, or the game would mark a right answer wrong. */
export function validWord(w: unknown): w is SplitWord {
  const x = w as SplitWord;
  if (!x || !splitGrades.includes(x.grade) || typeof x.word !== 'string' || !/^[A-Za-z]{2,16}$/.test(x.word) || typeof x.split !== 'string' || !validDate(x.unlocks) ||
    !ints(x.splitAfterLetter) || !ints(x.underline) || !ints(x.silentE) || !pairs(x.consonantLe) || !pairs(x.vowelTeams) || typeof x.yAsVowel !== 'boolean') return false;
  const parts = x.split.split('-'), n = x.word.length;
  const cuts = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('').length);
  const vowels = [...x.word].map((_, i) => i).filter(i => isVowelAt(x.word, i));
  return parts.join('') === x.word && parts.every(p => p) && JSON.stringify(cuts) === JSON.stringify(x.splitAfterLetter) &&
    JSON.stringify(vowels) === JSON.stringify(x.underline) && x.silentE.every(i => x.word[i] === 'e' && x.underline.includes(i)) &&
    x.yAsVowel === /y$/i.test(x.word) && [...x.consonantLe, ...x.vowelTeams].every(([a, b]) => a >= 0 && b < n) &&
    // A line never cuts a vowel team, and consonant + le always starts a syllable.
    !x.vowelTeams.some(([a, b]) => x.splitAfterLetter.some(k => k > a && k <= b)) && x.consonantLe.every(([a]) => x.splitAfterLetter.includes(a));
}
const loaded = (rawBank as { words: unknown[] }).words;
/** Fail closed: a bank with any inconsistent word is not played until it is fixed. */
export const bank: SplitWord[] = loaded.every(validWord) && new Set(loaded.map(w => wordId(w as SplitWord))).size === loaded.length ? loaded as SplitWord[] : [];
export const bankError = bank.length ? '' : 'The Split It! word list needs correcting before it can be played.';

/** Words for the grade that are unlocked by the teaching date (Current + Review, never before the unlock date). */
export const pool = (grade: SplitGrade, asOf: string, words: readonly SplitWord[] = bank) => words.filter(w => w.grade === grade && w.unlocks <= asOf);

// ---- Teaching notes and rules (plain words, from the PL handouts) ----
/** Vowel letters that are heard: every underlined vowel except silent e. A team's letters sit side by side, so the
 * nearest vowel on each side of a line is the end (or start) of the team and the letters between are consonants. */
const heardVowels = (w: SplitWord) => w.underline.filter(i => !w.silentE.includes(i));
export function notes(w: SplitWord): string[] {
  const out: string[] = [];
  const syllables = w.splitAfterLetter.length + 1;
  out.push(`${syllables} vowel sounds, so ${syllables} syllables.`);
  if (w.silentE.length) out.push('Silent e: the e at the end makes no sound, so it gets no line before it.');
  for (const [a, b] of w.vowelTeams) out.push(`Vowel team “${w.word.slice(a, b + 1)}”: two letters, one sound. No line between them.`);
  for (const [a, b] of w.consonantLe) out.push(`Consonant + le “${w.word.slice(a, b + 1)}”: it stays together.`);
  if (w.yAsVowel) out.push('y at the end of a word is a vowel.');
  return out;
}
export interface LineRule { after: number; consonants: number; kind: 'one' | 'two' | 'more' | 'consonant-le'; text: string }
/** Why each line goes where it does, worked out from the letters (the handout's rules in plain words). */
export function lineRules(w: SplitWord): LineRule[] {
  const sounds = heardVowels(w);
  return w.splitAfterLetter.map(k => {
    const cle = w.consonantLe.find(([a]) => a === k);
    const left = Math.max(...sounds.filter(i => i < k)), right = Math.min(...sounds.filter(i => i >= k));
    const consonants = right - left - 1;
    if (cle) return { after: k, consonants, kind: 'consonant-le' as const, text: `Consonant + le “${w.word.slice(cle[0], cle[1] + 1)}” stays together: the line goes before it.` };
    if (consonants === 1) return { after: k, consonants, kind: 'one' as const, text: `1 consonant (${w.word[k]}) between the vowels: the line goes before it.` };
    const between = [...w.word.slice(left + 1, right)].join(', ');
    if (consonants === 2) return { after: k, consonants, kind: 'two' as const, text: `2 consonants (${between}) between the vowels: the line goes between them.` };
    const kept = w.word.slice(k, right);
    return { after: k, consonants, kind: 'more' as const, text: `${consonants} consonants (${between}) between the vowels: the line goes between them${kept.length > 1 ? `, keeping “${kept}” together` : ''}.` };
  });
}
export const syllables = (w: SplitWord) => w.split.split('-');

// ---- Game state ----
export type Phase = 'vowels' | 'notes' | 'lines' | 'done';
export const phases: readonly Phase[] = ['vowels', 'notes', 'lines', 'done'];
export interface AskedWord {
  /** Unique in the game: the word id, or id~2, id~3… after the list starts over. */
  key: string; id: string; teamId?: string; phase: Phase;
  vowels: number[]; vowelChecks: number; vowelsShown: boolean;
  lines: number[]; lineChecks: number; linesShown: boolean;
  /** Right on the first Check (null until checked). Only these earn points. */
  vowelsFirst: boolean | null; linesFirst: boolean | null;
}
export interface SplitState {
  version: 1; screen: 'setup' | 'play' | 'complete';
  grade: SplitGrade | null; teamCount: number; names: string[]; // teamCount 0 = Teams Off; names[i] '' = colour name
  movement: 0 | ExerciseDuration; // 0 = Movement Off
  asOf: string;
  asked: AskedWord[]; queue: string[]; pass: number; index: number;
  /** "That's every word for now!": every word in this pass has been asked. */
  exhausted: boolean;
  sessionId?: string; startedAt?: string; endedAt?: string; teams?: AssessmentTeam[];
  /** Word ids already used per grade, so games avoid repeats until that grade's list runs out. */
  seen: Partial<Record<SplitGrade, string[]>>;
}
export const freshState = (): SplitState => ({ version: 1, screen: 'setup', grade: null, teamCount: 0, names: Array(MAX_TEAMS).fill(''), movement: 0, asOf: schoolDate(), asked: [], queue: [], pass: 1, index: 0, exhausted: false, seen: {} });
export const teamDefaultName = (i: number) => splitTeamColors[i].name;
export function createTeams(count: number, names: readonly string[]): AssessmentTeam[] {
  return Array.from({ length: count }, (_, i) => ({ id: `team-${i + 1}`, name: names[i]?.trim() || teamDefaultName(i), accent: splitTeamColors[i].accent }));
}
export const wordFor = (id: string) => bank.find(w => wordId(w) === id);
/** Monday of the school week containing `date`. */
export const mondayOf = (date: string) => { const d = new Date(`${fridayOf(date)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 4); return d.toISOString().slice(0, 10); };

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
/** Unseen words: this school week's first, then review, each part shuffled. */
export function orderQueue(available: readonly SplitWord[], seen: readonly string[], asOf: string, random = Math.random): string[] {
  const week = mondayOf(asOf), unseen = available.filter(w => !seen.includes(wordId(w)));
  return [...shuffle(unseen.filter(w => w.unlocks >= week), random), ...shuffle(unseen.filter(w => w.unlocks < week), random)].map(wordId);
}
function ask(s: SplitState): SplitState {
  const [id, ...queue] = s.queue;
  const teams = s.teams ?? [];
  // Teams take turns at the board, one word each, in colour order.
  const teamId = teams.length ? teams[s.asked.length % teams.length].id : undefined;
  const word: AskedWord = { key: s.pass === 1 ? id : `${id}~${s.pass}`, id, ...(teamId ? { teamId } : {}), phase: 'vowels', vowels: [], vowelChecks: 0, vowelsShown: false, lines: [], lineChecks: 0, linesShown: false, vowelsFirst: null, linesFirst: null };
  const seen = s.seen[s.grade!] ?? [];
  return { ...s, asked: [...s.asked, word], queue, index: s.asked.length, exhausted: false, seen: { ...s.seen, [s.grade!]: seen.includes(id) ? seen : [...seen, id] } };
}
export function begin(s: SplitState, available: readonly SplitWord[], id: string, now: string, random = Math.random): SplitState {
  if (!s.grade || !available.length) return s;
  let seen = s.seen[s.grade] ?? [], queue = orderQueue(available, seen, s.asOf, random);
  // Every word was used in earlier games: this game starts the list over (only these words are forgotten).
  if (!queue.length) { seen = seen.filter(x => !available.some(w => wordId(w) === x)); queue = orderQueue(available, seen, s.asOf, random); }
  return ask({ ...s, screen: 'play', asked: [], queue, pass: 1, index: 0, exhausted: false, sessionId: id, startedAt: now, endedAt: undefined,
    teams: s.teamCount ? createTeams(s.teamCount, s.names) : [], seen: { ...s.seen, [s.grade]: seen } });
}
export const current = (s: SplitState): AskedWord | undefined => s.screen === 'play' && !s.exhausted ? s.asked[s.index] : undefined;
function patch(s: SplitState, change: (a: AskedWord, w: SplitWord) => AskedWord): SplitState {
  const a = current(s), w = a && wordFor(a.id);
  return a && w ? { ...s, asked: s.asked.map((x, i) => i === s.index ? change(a, w) : x) } : s;
}
const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every(x => b.includes(x));
/** Teams on: each step gets one try. The team's own taps are kept so the board can mark them; Teams Off may retry. */
export const oneTry = (a: AskedWord) => !!a.teamId;
const toggle = (list: readonly number[], n: number) => list.includes(n) ? list.filter(x => x !== n) : [...list, n].sort((x, y) => x - y);

/** Tap a letter to underline it (or remove the underline). Only while finding vowels. */
export const toggleVowel = (s: SplitState, letter: number) => patch(s, (a, w) => a.phase === 'vowels' && !(oneTry(a) && a.vowelChecks) && letter >= 0 && letter < w.word.length ? { ...a, vowels: toggle(a.vowels, letter) } : a);
/** Tap the gap after a letter to draw a line (or remove it). Only while drawing lines. */
export const toggleLine = (s: SplitState, after: number) => patch(s, (a, w) => a.phase === 'lines' && !(oneTry(a) && a.lineChecks) && after > 0 && after < w.word.length ? { ...a, lines: toggle(a.lines, after) } : a);
/** Check vowels. Teams on: one try, right or wrong it moves on to the notes (a wrong try is marked on the board).
 * Teams Off: right moves on; wrong stays for another try. The first Check decides the point. */
export const checkVowels = (s: SplitState) => patch(s, (a, w) => {
  if (a.phase !== 'vowels' || (oneTry(a) && a.vowelChecks)) return a;
  const right = sameSet(a.vowels, w.underline);
  return { ...a, vowelChecks: a.vowelChecks + 1, vowelsFirst: a.vowelsFirst ?? right, phase: right || oneTry(a) ? 'notes' : 'vowels' };
});
/** Teams Off, after a wrong Check: show the right vowels (no point). */
export const showVowels = (s: SplitState) => patch(s, (a, w) => a.phase === 'vowels' && a.vowelChecks > 0 && !oneTry(a) ? { ...a, vowels: [...w.underline], vowelsShown: true, phase: 'notes' } : a);
export const toLines = (s: SplitState) => patch(s, a => a.phase === 'notes' ? { ...a, phase: 'lines' } : a);
export const checkLines = (s: SplitState) => patch(s, (a, w) => {
  if (a.phase !== 'lines' || (oneTry(a) && a.lineChecks)) return a;
  const right = sameSet(a.lines, w.splitAfterLetter);
  return { ...a, lineChecks: a.lineChecks + 1, linesFirst: a.linesFirst ?? right, phase: right || oneTry(a) ? 'done' : 'lines' };
});
export const showLines = (s: SplitState) => patch(s, (a, w) => a.phase === 'lines' && a.lineChecks > 0 && !oneTry(a) ? { ...a, lines: [...w.splitAfterLetter], linesShown: true, phase: 'done' } : a);
/** Teams Off only: a wrong Check leaves the step open with "Not yet" and Show me. */
export const wrongCheck = (a: AskedWord) => !oneTry(a) && ((a.phase === 'vowels' && a.vowelChecks > 0) || (a.phase === 'lines' && a.lineChecks > 0));
/** Teams on, after a wrong one try: the team's taps against the answer. */
export function marking(a: AskedWord, w: SplitWord) {
  const vowels = oneTry(a) && a.vowelsFirst === false, lines = oneTry(a) && a.linesFirst === false;
  return {
    wrongLetters: vowels ? a.vowels.filter(i => !w.underline.includes(i)) : [], missedVowels: vowels ? w.underline.filter(i => !a.vowels.includes(i)) : [],
    wrongLines: lines ? a.lines.filter(k => !w.splitAfterLetter.includes(k)) : [], missedLines: lines ? w.splitAfterLetter.filter(k => !a.lines.includes(k)) : [],
  };
}

/** Next after a word is done: forward through words already asked (after Back), else the next word, else "every word". */
export function next(s: SplitState): SplitState {
  const a = current(s);
  if (!a || a.phase !== 'done') return s;
  if (s.index < s.asked.length - 1) return { ...s, index: s.index + 1 };
  return s.queue.length ? ask(s) : { ...s, exhausted: true };
}
/** Back steps the flow backwards: leave "every word", go back one step in the word, or return to the previous word.
 * Checks already made (and their points) are kept. Teams on, a checked step is never reopened for a second try:
 * Back goes to the previous word, except from lines (not yet checked) back to the notes. */
export function back(s: SplitState): SplitState {
  if (s.screen !== 'play') return s;
  if (s.exhausted) return { ...s, exhausted: false };
  const a = current(s)!;
  const step = phases.indexOf(a.phase);
  if (oneTry(a)) {
    if (a.phase === 'lines' && !a.lineChecks) return patch(s, x => ({ ...x, phase: 'notes' }));
    return s.index > 0 ? { ...s, index: s.index - 1 } : s;
  }
  if (step > 0) return patch(s, x => ({ ...x, phase: phases[step - 1] }));
  return s.index > 0 ? { ...s, index: s.index - 1 } : s;
}
/** After "That's every word for now!": a new pass over the grade's list. */
export function startOver(s: SplitState, available: readonly SplitWord[], random = Math.random): SplitState {
  if (s.screen !== 'play' || !s.exhausted || !s.grade) return s;
  const seen = (s.seen[s.grade] ?? []).filter(x => !available.some(w => wordId(w) === x));
  const queue = orderQueue(available, [], s.asOf, random);
  return queue.length ? ask({ ...s, pass: s.pass + 1, queue, seen: { ...s.seen, [s.grade]: seen } }) : s;
}
export const end = (s: SplitState, now: string): SplitState => s.screen === 'play' ? { ...s, screen: 'complete', exhausted: false, endedAt: now } : s;
/** Undo an accidental End. Ending again replaces the saved history record (same session id). */
export const keepGoing = (s: SplitState): SplitState => s.screen === 'complete' ? { ...s, screen: 'play', endedAt: undefined } : s;

/** 1 point for vowels right on the first Check, 1 for lines right on the first Check. */
export const wordPoints = (a: AskedWord) => (a.vowelsFirst ? 1 : 0) + (a.linesFirst ? 1 : 0);
export const scores = (s: SplitState) => (s.teams ?? []).map(t => ({ ...t, score: s.asked.filter(a => a.teamId === t.id).reduce((n, a) => n + wordPoints(a), 0) }));
export function winners(s: SplitState) {
  const all = scores(s), top = Math.max(0, ...all.map(t => t.score));
  return all.filter(t => t.score === top);
}

/** The finished game as a shared assessment session ("Split It!" in Session History): per word, a vowels step and a
 * lines step, each once it has been checked, credited to the team at the board. */
export function toSession(s: SplitState): GameSession | null {
  if (s.screen !== 'complete' || !s.sessionId || !s.startedAt || !s.endedAt || !s.grade) return null;
  const teams = s.teams ?? [];
  let session = createSession({ id: s.sessionId, gameType: 'split-it', grade: s.grade, mode: teams.length ? 'team' : 'classic', teams, startedAt: s.startedAt });
  for (const a of s.asked) {
    const w = wordFor(a.id); if (!w) continue;
    const steps = [['vowels', 'Vowels', `Underline every vowel in “${w.word}”`, a.vowelsFirst], ['lines', 'Syllable lines', `Split “${w.word}” (${w.split})`, a.linesFirst]] as const;
    for (const [step, concept, prompt, first] of steps) {
      if (first === null) continue;
      session = commitQuestion(session, { questionId: `${a.key}:${step}`, subject: 'Literacy', concept, prompt },
        a.teamId ? [{ teamId: a.teamId, correct: first, pointsAwarded: first ? 1 : 0 }] : [], s.endedAt);
    }
  }
  return endSession(session, s.endedAt);
}

// ---- Saves (browser-local) ----
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
function isAsked(a: unknown, teams: readonly AssessmentTeam[]): a is AskedWord {
  const x = a as AskedWord, w = x && wordFor(x.id);
  const n = w ? w.word.length : 0;
  return !!w && text(x.key) && phases.includes(x.phase) && (x.teamId === undefined ? !teams.length : teams.some(t => t.id === x.teamId)) &&
    ints(x.vowels) && x.vowels.every(i => i >= 0 && i < n) && ints(x.lines) && x.lines.every(i => i > 0 && i < n) &&
    Number.isInteger(x.vowelChecks) && x.vowelChecks >= 0 && Number.isInteger(x.lineChecks) && x.lineChecks >= 0 &&
    typeof x.vowelsShown === 'boolean' && typeof x.linesShown === 'boolean' &&
    (x.vowelsFirst === null ? x.vowelChecks === 0 : typeof x.vowelsFirst === 'boolean' && x.vowelChecks > 0) &&
    (x.linesFirst === null ? x.lineChecks === 0 : typeof x.linesFirst === 'boolean' && x.lineChecks > 0) &&
    (x.teamId === undefined
      // Teams Off: past the vowels step means the vowels were found (or shown); past lines means the lines were.
      ? (x.phase === 'vowels' || sameSet(x.vowels, w.underline)) && (x.phase !== 'done' || sameSet(x.lines, w.splitAfterLetter))
      // Teams on: one try per step, checked exactly when the word is past that step, and scored on the taps kept.
      : x.vowelChecks === (x.phase === 'vowels' ? 0 : 1) && x.lineChecks === (x.phase === 'done' ? 1 : 0) && !x.vowelsShown && !x.linesShown &&
        (x.vowelsFirst === null || x.vowelsFirst === sameSet(x.vowels, w.underline)) && (x.linesFirst === null || x.linesFirst === sameSet(x.lines, w.splitAfterLetter)));
}
export function isSplitState(v: unknown): v is SplitState {
  const s = v as SplitState;
  if (!s || s.version !== 1 || !['setup', 'play', 'complete'].includes(s.screen) || (s.grade !== null && !splitGrades.includes(s.grade)) ||
    !Number.isInteger(s.teamCount) || (s.teamCount !== 0 && (s.teamCount < MIN_TEAMS || s.teamCount > MAX_TEAMS)) ||
    !Array.isArray(s.names) || s.names.length !== MAX_TEAMS || !s.names.every(n => typeof n === 'string' && n.length <= NAME_LIMIT) ||
    !(s.movement === 0 || exerciseDurations.includes(s.movement)) || !validDate(s.asOf) || !Array.isArray(s.queue) || !s.queue.every(id => !!wordFor(id)) ||
    !Number.isInteger(s.pass) || s.pass < 1 || typeof s.exhausted !== 'boolean' || !Number.isInteger(s.index) || !s.seen || typeof s.seen !== 'object' ||
    !Object.entries(s.seen).every(([g, ids]) => splitGrades.includes(g as SplitGrade) && Array.isArray(ids) && ids.every(text)) || !Array.isArray(s.asked)) return false;
  if (s.screen === 'setup') return true;
  const teams = s.teams ?? [];
  if (!s.grade || !s.asked.length || s.index < 0 || s.index >= s.asked.length || !text(s.sessionId) || !text(s.startedAt) || teams.length !== s.teamCount ||
    !s.asked.every(a => isAsked(a, teams)) || new Set(s.asked.map(a => a.key)).size !== s.asked.length) return false;
  if (s.screen === 'complete') { try { const session = toSession(s); return !!session && isGameSession(session); } catch { return false; } }
  return !s.endedAt;
}
/** An unreadable or invalid save opens a fresh setup (as in Quick Check); its next save replaces it. */
export function loadState(store: Pick<Storage, 'getItem'> = localStorage): SplitState {
  try {
    const s = JSON.parse(store.getItem(SPLIT_IT_KEY) || 'null');
    if (!isSplitState(s)) return freshState();
    // Setup always starts from today; a game in progress keeps its own teaching date.
    return s.screen === 'setup' ? { ...s, asOf: schoolDate() } : s;
  } catch { return freshState(); }
}
export function saveState(s: SplitState, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(SPLIT_IT_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
/** Back to setup with the same choices; word history is kept. */
export const toSetup = (s: SplitState): SplitState => ({ ...freshState(), grade: s.grade, teamCount: s.teamCount, names: s.names, movement: s.movement, seen: s.seen });
