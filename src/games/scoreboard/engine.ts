import { teamColors } from '../four-corners/teams';

/** Browser-local only. Holds team names, colors and scores; no student data. */
export const SCOREBOARD_KEY = 'classthread.scoreboard.v1';
export const MIN_TEAMS = 2, MAX_TEAMS = 15, NAME_LIMIT = 16, HISTORY_LIMIT = 100;
export const STEPS = [1, 2, 3, 5] as const;
export type Step = typeof STEPS[number];

// Teams 1–10 match the other games (Four Corners 1–6, State Lingo Bingo 7–10); 11–15 are added for big classes.
export const scoreboardColors = [
  ...teamColors,
  { name: 'Pink', accent: '#f472b6' },
  { name: 'Aqua', accent: '#22d3ee' },
  { name: 'White', accent: '#f1f5f9' },
  { name: 'Tan', accent: '#d4a373' },
  { name: 'Lime', accent: '#a3e635' },
  { name: 'Maroon', accent: '#9f1239' },
  { name: 'Gray', accent: '#94a3b8' },
  { name: 'Brown', accent: '#92400e' },
  { name: 'Black', accent: '#111827' },
];
export const colorCount = scoreboardColors.length;

export interface ScoreTeam { name: string; color: number; score: number }
export interface ScoreState { version: 1; count: number; step: Step; teams: ScoreTeam[]; history: number[][] }

/** Every slot exists from the start, so lowering the team count hides teams without losing their scores. */
export const freshState = (): ScoreState => ({
  version: 1, count: 4, step: 1, history: [],
  teams: scoreboardColors.map((c, i) => ({ name: c.name, color: i, score: 0 })),
});

const scores = (s: ScoreState) => s.teams.map(t => t.score);
const remember = (s: ScoreState) => [...s.history, scores(s)].slice(-HISTORY_LIMIT);

/** Adds (or takes away) points. Scores never go below zero; a change that does nothing is not added to Undo. */
export function addPoints(s: ScoreState, index: number, delta: number): ScoreState {
  if (index < 0 || index >= s.count) return s;
  const next = Math.max(0, s.teams[index].score + delta);
  if (next === s.teams[index].score) return s;
  return { ...s, history: remember(s), teams: s.teams.map((t, i) => i === index ? { ...t, score: next } : t) };
}
export function undo(s: ScoreState): ScoreState {
  const last = s.history[s.history.length - 1];
  if (!last) return s;
  return { ...s, history: s.history.slice(0, -1), teams: s.teams.map((t, i) => ({ ...t, score: last[i] ?? t.score })) };
}
/** Clears every score (shown and hidden). Undo brings them back. */
export function resetScores(s: ScoreState): ScoreState {
  if (s.teams.every(t => t.score === 0)) return s;
  return { ...s, history: remember(s), teams: s.teams.map(t => ({ ...t, score: 0 })) };
}
export const setCount = (s: ScoreState, count: number): ScoreState =>
  ({ ...s, count: Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Math.round(count))) });
export const setStep = (s: ScoreState, step: Step): ScoreState => STEPS.includes(step) ? { ...s, step } : s;
export const rename = (s: ScoreState, index: number, name: string): ScoreState =>
  ({ ...s, teams: s.teams.map((t, i) => i === index ? { ...t, name: name.slice(0, NAME_LIMIT) } : t) });
/** A team still named after its old color takes the new color's name; a custom name is kept. */
export function recolor(s: ScoreState, index: number, color: number): ScoreState {
  if (!Number.isInteger(color) || color < 0 || color >= colorCount) return s;
  return { ...s, teams: s.teams.map((t, i) => {
    if (i !== index) return t;
    const named = !t.name.trim() || t.name.trim() === scoreboardColors[t.color].name;
    return { ...t, color, name: named ? scoreboardColors[color].name : t.name };
  }) };
}
export const displayName = (t: ScoreTeam, index: number) => t.name.trim() || `Team ${index + 1}`;

/** Teams in the lead. Empty when nobody has scored or every shown team is tied, so nobody is spotlighted. */
export function leaders(s: ScoreState): number[] {
  const shown = s.teams.slice(0, s.count), top = Math.max(...shown.map(t => t.score));
  const lead = shown.flatMap((t, i) => t.score === top ? [i] : []);
  return top > 0 && lead.length < shown.length ? lead : [];
}

/** Picks the column count that gives the biggest tiles for the space (tiles slightly wider than tall). */
export function fitGrid(count: number, width: number, height: number, gap: number) {
  let best = { columns: 1, width: 0, height: 0, size: -1 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const w = (width - (columns - 1) * gap) / columns, h = (height - (rows - 1) * gap) / rows;
    if (w <= 0 || h <= 0) continue;
    const size = Math.min(w / 1.35, h);
    if (size > best.size) best = { columns, width: Math.floor(w), height: Math.floor(h), size };
  }
  return best;
}

function valid(value: unknown): value is ScoreState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<ScoreState>;
  return s.version === 1 && Number.isInteger(s.count) && s.count! >= MIN_TEAMS && s.count! <= MAX_TEAMS &&
    STEPS.includes(s.step as Step) && Array.isArray(s.teams) && s.teams.length === MAX_TEAMS &&
    s.teams.every(t => t && typeof t.name === 'string' && t.name.length <= NAME_LIMIT &&
      Number.isInteger(t.color) && t.color >= 0 && t.color < colorCount && Number.isInteger(t.score) && t.score >= 0) &&
    Array.isArray(s.history) && s.history.every(h => Array.isArray(h) && h.length === MAX_TEAMS && h.every(n => Number.isInteger(n) && n >= 0));
}
/** A missing, corrupt or unknown save starts fresh rather than breaking the page. */
export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): ScoreState {
  try { const parsed: unknown = JSON.parse(storage.getItem(SCOREBOARD_KEY) ?? 'null'); return valid(parsed) ? parsed : freshState(); }
  catch { return freshState(); }
}
export function saveState(s: ScoreState, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(SCOREBOARD_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
/** Dark text on light team colors, white text on dark ones. */
export function textOn(hex: string) {
  const channel = (i: number) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  return .2126 * channel(1) + .7152 * channel(3) + .0722 * channel(5) > .2 ? '#0B1F44' : '#FFFFFF';
}
