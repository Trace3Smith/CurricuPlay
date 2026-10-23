import { test, expect } from '@playwright/test';
import shapes from '../src/data/state-shapes.json' with { type: 'json' };
import { isGameSession, summarizeSession } from '../src/assessment/engine';
import { gameName } from '../src/assessment/gameNames';
import { teamColors } from '../src/games/four-corners/teams';
import {
  beginGame, bingoColors, boardLayout, buildSession, cardLines, completedLines, createTeams, defaultSize, endGame, freshSettings, generateCard, isBingoState,
  isBlackout, judge, nameErrors, pool, progress, regions, report, setTarget, setupErrors, states, undo, type BingoState, type Settings,
} from '../src/games/state-lingo-bingo/engine';
import { readActive, saveActive, UNREADABLE } from '../src/games/state-lingo-bingo/storage';
import { BINGO_ACTIVE_KEY } from '../src/games/state-lingo-bingo/keys';

const t0 = Date.parse('2026-10-23T14:00:00.000Z');
const at = (s: number) => new Date(t0 + s * 1000).toISOString();
function seeded(seed = 1) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...freshSettings('4'), teamCount: 2, ...patch });
function game(patch: Partial<Settings> = {}, seed = 1): BingoState { return beginGame(settings(patch), 'session-1', at(0), seeded(seed))!; }
/** Target then mark each listed square for a team, one second apart. */
function play(s: BingoState, teamId: string, squares: number[], kind: 'correct' | 'wrong' = 'correct', start = (s.events?.length ?? 0) + 1): BingoState {
  squares.forEach((i, n) => { s = setTarget(s, teamId, s.cards![teamId][i]!, at(start + n * 2)); s = judge(s, teamId, kind, at(start + n * 2 + 1)); });
  return s;
}

test('Capitals data: 50 states, Census regions, official .gov sources, and a shape for every state', () => {
  expect(states).toHaveLength(50);
  expect(new Set(states.map(s => s.code)).size).toBe(50);
  expect(new Set(states.map(s => s.fips)).size).toBe(50);
  expect(states.every(s => s.capital.trim() && s.name.trim())).toBe(true);
  expect(Object.fromEntries(regions.map(r => [r, pool([r]).length]))).toEqual({ Northeast: 9, Midwest: 12, South: 16, West: 13 });
  for (const s of states) {
    const url = new URL(s.source);
    expect(url.protocol).toBe('https:');
    expect(url.hostname.endsWith('.gov'), `${s.name}: ${s.source}`).toBe(true);
    expect(url.hostname).not.toContain('wikipedia');
    const shape = (shapes.states as Record<string, { name: string; d: string; bbox: number[] }>)[s.fips];
    expect(shape.name).toBe(s.name);
    expect(shape.d.startsWith('M')).toBe(true);
    expect(shape.bbox[2] > 0 && shape.bbox[3] > 0).toBe(true);
  }
  expect(Object.keys(shapes.states)).toHaveLength(50);
  expect(shapes.source.derivedFrom).toContain('Census Bureau');
});

test('Card generation: no duplicate squares, free center on 5×5, only selected regions, and size rules', () => {
  for (let seed = 1; seed < 40; seed++) {
    const four = generateCard(4, ['South'], seeded(seed));
    expect(four).toHaveLength(16); expect(new Set(four).size).toBe(16);
    expect(four.every(c => pool(['South']).some(s => s.code === c))).toBe(true);
    const five = generateCard(5, ['Midwest', 'West'], seeded(seed));
    expect(five).toHaveLength(25); expect(five[12]).toBeNull();
    const codes = five.filter(Boolean);
    expect(codes).toHaveLength(24); expect(new Set(codes).size).toBe(24);
    expect(codes.every(c => ['Midwest', 'West'].includes(states.find(s => s.code === c)!.region))).toBe(true);
  }
  expect(() => generateCard(4, ['Northeast'])).toThrow();
  expect(() => generateCard(5, ['Northeast', 'Midwest'])).toThrow();
  expect(setupErrors(settings({ size: 4, regions: ['Northeast'] }))).toEqual(['A 4×4 card needs at least 16 states. The selected regions have 9.']);
  expect(setupErrors(settings({ size: 5, regions: ['Northeast', 'Midwest'] }))).toEqual(['A 5×5 card needs at least 24 states. The selected regions have 21.']);
  expect(setupErrors(settings({ size: 4, regions: ['Northeast', 'Midwest'] }))).toEqual([]);
  expect(beginGame(settings({ size: 4, regions: ['Northeast'] }), 'x', at(0))).toBeNull();
  expect(defaultSize('3')).toBe(4); expect(defaultSize('4')).toBe(5); expect(defaultSize('5')).toBe(5);
  // Each team gets its own card.
  const s = game({ teamCount: 6 });
  expect(new Set(Object.values(s.cards!).map(c => c.join())).size).toBe(6);
});

test('Bingo detection: rows, columns, diagonals, free center and blackout', () => {
  expect(cardLines(4)).toHaveLength(10); expect(cardLines(5)).toHaveLength(12);
  const card4 = generateCard(4, [...regions], seeded(3)) as string[];
  const marks = (idx: number[], card = card4) => new Set(idx.map(i => card[i]!));
  expect(completedLines(card4, marks([0, 1, 2]))).toHaveLength(0);
  expect(completedLines(card4, marks([0, 1, 2, 3]))).toEqual([[0, 1, 2, 3]]);
  expect(completedLines(card4, marks([1, 5, 9, 13]))).toEqual([[1, 5, 9, 13]]);
  expect(completedLines(card4, marks([0, 5, 10, 15]))).toEqual([[0, 5, 10, 15]]);
  expect(completedLines(card4, marks([3, 6, 9, 12]))).toEqual([[3, 6, 9, 12]]);
  const card5 = generateCard(5, [...regions], seeded(4));
  // The free center completes its row, column and both diagonals with four marks each.
  expect(completedLines(card5, marks([10, 11, 13, 14], card5 as string[]))).toEqual([[10, 11, 12, 13, 14]]);
  expect(completedLines(card5, marks([2, 7, 17, 22], card5 as string[]))).toEqual([[2, 7, 12, 17, 22]]);
  expect(completedLines(card5, marks([0, 6, 18, 24], card5 as string[]))).toEqual([[0, 6, 12, 18, 24]]);
  expect(completedLines(card5, marks([4, 8, 16, 20], card5 as string[]))).toEqual([[4, 8, 12, 16, 20]]);
  const all = new Set(card5.filter(Boolean) as string[]);
  expect(isBlackout(card5, all)).toBe(true);
  expect(completedLines(card5, all)).toHaveLength(12);
  all.delete(card5[0]!); expect(isBlackout(card5, all)).toBe(false);
});

test('Scoring: 1 per capital, +5 per line, +20 blackout, all editable; play continues after a bingo', () => {
  let s = game({ size: 4 });
  s = play(s, 'team-1', [0, 1, 2]);
  expect(progress(s, 'team-1')).toMatchObject({ score: 3, lines: 0, blackout: false });
  s = play(s, 'team-1', [3]);
  expect(progress(s, 'team-1')).toMatchObject({ score: 4 + 5, lines: 1 });
  s = play(s, 'team-1', [4, 5, 6, 7]);
  expect(progress(s, 'team-1').score).toBe(8 + 10);
  // Fill the rest: 16 capitals, 10 lines, blackout.
  s = play(s, 'team-1', [8, 9, 10, 11, 12, 13, 14, 15]);
  expect(progress(s, 'team-1')).toMatchObject({ score: 16 + 50 + 20, lines: 10, blackout: true });
  expect(progress(s, 'team-2').score).toBe(0);
  const custom = play(game({ size: 4, scoring: { capital: 2, line: 3, blackout: 7 } }), 'team-1', Array.from({ length: 16 }, (_, i) => i));
  expect(progress(custom, 'team-1').score).toBe(32 + 30 + 7);
  expect(setupErrors(settings({ scoring: { capital: 1, line: -1, blackout: 20 } }))).toEqual(['Scoring values must be whole numbers from 0 to 100.']);
});

test('Targets and judging: only unmarked squares on the team’s own card; judging needs a target', () => {
  let s = game({ size: 5 });
  const other = s.cards!['team-2'].find(c => c && !s.cards!['team-1'].includes(c))!;
  expect(setTarget(s, 'team-1', other, at(1))).toBe(s);
  expect(judge(s, 'team-1', 'correct', at(1))).toBe(s);
  s = play(s, 'team-1', [0]);
  expect(setTarget(s, 'team-1', s.cards!['team-1'][0]!, at(9))).toBe(s); // already marked
  expect(progress(s, 'team-1').target).toBeNull();
  // A target can be changed before the tile comes back.
  s = setTarget(s, 'team-1', s.cards!['team-1'][1]!, at(10));
  s = setTarget(s, 'team-1', s.cards!['team-1'][2]!, at(11));
  expect(progress(s, 'team-1').target).toBe(s.cards!['team-1'][2]);
});

test('Undo removes exactly the last tap, including a wrong tile, and never changes other teams', () => {
  let s = game();
  const code = s.cards!['team-1'][0]!;
  s = setTarget(s, 'team-1', code, at(1));
  s = judge(s, 'team-1', 'wrong', at(2));
  expect(progress(s, 'team-1')).toMatchObject({ wrong: 1, target: code });
  expect(buildSession(s).responses).toHaveLength(1);
  s = undo(s);
  expect(progress(s, 'team-1')).toMatchObject({ wrong: 0, target: code });
  expect(buildSession(s).responses).toHaveLength(0);
  s = judge(s, 'team-1', 'correct', at(3));
  s = play(s, 'team-2', [0], 'correct', 4);
  expect(progress(s, 'team-1').marked.has(code)).toBe(true);
  s = undo(s); // team 2's correct
  expect(progress(s, 'team-2').marked.size).toBe(0);
  expect(progress(s, 'team-2').target).toBe(s.cards!['team-2'][0]);
  expect(progress(s, 'team-1').marked.has(code)).toBe(true);
  s = undo(undo(undo(s)));
  expect(s.events).toEqual([]);
  expect(undo(s)).toBe(s);
  expect(undo(endGame(play(s, 'team-1', [0]), at(30)))).toEqual(endGame(play(s, 'team-1', [0]), at(30)));
});

test('Assessment records: every correct and wrong tile per team with target state and time, using the shared session format', () => {
  let s = game({ size: 4, teamCount: 3 });
  s = play(s, 'team-1', [0], 'wrong', 1);
  s = judge(s, 'team-1', 'wrong', at(4));
  s = judge(s, 'team-1', 'correct', at(5));
  s = play(s, 'team-2', [0, 1, 2, 3], 'correct', 6);
  s = endGame(s, at(60));
  const session = buildSession(s);
  expect(isGameSession(session)).toBe(true);
  expect(session).toMatchObject({ gameType: 'state-lingo-bingo', grade: '4', mode: 'team', endedAt: at(60) });
  expect(gameName(session.gameType)).toBe('State Lingo Bingo');
  expect(gameName('four-corners')).toBe('Four Corners');
  const t1 = session.responses.filter(r => r.teamId === 'team-1');
  const first = states.find(st => st.code === s.cards!['team-1'][0])!;
  expect(t1.map(r => [r.correct, r.pointsAwarded, r.concept, r.answeredAt])).toEqual([[false, 0, first.name, at(2)], [false, 0, first.name, at(4)], [true, 1, first.name, at(5)]]);
  expect(session.questions.find(q => q.questionId === session.responses[0].questionId)!.prompt).toBe(`${first.name} — capital: ${first.capital}`);
  // Bonus points ride on the tap that earned them, so shared reports match the board.
  const summary = summarizeSession(session);
  expect(summary.teams.map(t => t.score)).toEqual([1, 9, 0]);
  expect(summary.teams.map(t => t.score)).toEqual(s.teams!.map(t => progress(s, t.id).score));
  expect(summary.teams[0].overall).toMatchObject({ correct: 1, attempts: 3 });
  expect(summary.subjects.map(x => x.subject)).toEqual(['States & Capitals']);
  const r = report(s);
  expect(r.teams[0]).toMatchObject({ correct: 1, wrong: 2, missed: [first.code], score: 1 });
  expect(r.review.filter(i => i.reason === 'missed')).toEqual([{ state: first.code, teamId: 'team-1', reason: 'missed' }]);
  // Longest to find: target at 1s, correct at 5s.
  expect(r.review.find(i => i.reason === 'slow')).toEqual({ state: first.code, teamId: 'team-1', reason: 'slow', seconds: 4 });
});

test('Custom team names: defaults, trimming, the length limit, duplicates, and colors for all 10 teams', () => {
  expect(createTeams(settings({ teamCount: 10 })).map(t => t.name)).toEqual(Array.from({ length: 10 }, (_, i) => `Team ${i + 1}`));
  expect(bingoColors.slice(0, 6)).toEqual(teamColors.map(c => c.accent));
  expect(new Set(bingoColors).size).toBe(10);
  const names = ['  Rockets  ', 'Thunder', ...Array(8).fill('')];
  expect(nameErrors(names, 3)).toEqual([]);
  const s = beginGame(settings({ teamCount: 3, names }), 'id', at(0))!;
  expect(s.teams!.map(t => t.name)).toEqual(['Rockets', 'Thunder', 'Team 3']);
  expect(s.teams!.map(t => t.accent)).toEqual(bingoColors.slice(0, 3));
  expect(nameErrors(['A'.repeat(16), ...Array(9).fill('')], 2)).toEqual([]);
  expect(nameErrors(['A'.repeat(17), ...Array(9).fill('')], 2)).toEqual(['Team 1: names can be up to 16 characters.']);
  expect(nameErrors(['Hawks', 'hawks ', ...Array(8).fill('')], 2)).toEqual(['Team 2: “hawks” is already used by another team.']);
  expect(nameErrors(['Team 2', ...Array(9).fill('')], 2)).toEqual(['Team 2: “Team 2” is already used by another team.']);
  // A name only counts for teams in play.
  expect(nameErrors(['', '', 'X'.repeat(30), ...Array(7).fill('')], 2)).toEqual([]);
  expect(beginGame(settings({ names: ['A'.repeat(17), ...Array(9).fill('')] }), 'id', at(0))).toBeNull();
});

test('Board layout for every team count from 2 to 10', () => {
  expect(Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, boardLayout(n)]))).toEqual({
    2: [2, 1], 3: [3, 1], 4: [2, 2], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 2], 9: [5, 2], 10: [5, 2],
  });
});

test('Saved games validate by replay; tampering, backwards time and unknown teams are rejected', () => {
  let s = play(game({ size: 5, teamCount: 4 }), 'team-1', [0, 1, 2]);
  s = setTarget(s, 'team-3', s.cards!['team-3'][4]!, at(20));
  const raw = JSON.parse(JSON.stringify(s));
  expect(isBingoState(raw)).toBe(true);
  expect(isBingoState(JSON.parse(JSON.stringify(endGame(s, at(30)))))).toBe(true);
  const broken = (f: (x: any) => void) => { const x = structuredClone(raw); f(x); return isBingoState(x); };
  expect(broken(x => { x.events[1].state = x.cards['team-1'][5]; })).toBe(false); // judged a state that was not the target
  expect(broken(x => { x.events[3].at = at(0.5); })).toBe(false);
  expect(broken(x => { x.events[0].teamId = 'team-99'; })).toBe(false);
  expect(broken(x => { x.cards['team-1'][1] = x.cards['team-1'][0]; })).toBe(false);
  expect(broken(x => { x.cards['team-1'][12] = 'TX'; })).toBe(false);
  expect(broken(x => { x.teams[0].name = 'Renamed'; })).toBe(false);
  expect(broken(x => { x.settings.teamCount = 11; })).toBe(false);
  expect(broken(x => { x.version = 2; })).toBe(false);
  expect(broken(x => { x.screen = 'complete'; })).toBe(false);
  expect(broken(x => { x.events.push({ kind: 'correct', teamId: 'team-2', state: x.cards['team-2'][0], at: at(40) }); })).toBe(false);
});

test('Active save: an unfinished game round-trips exactly; an unreadable save is never overwritten', () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  let s = play(game({ teamCount: 3 }), 'team-2', [0, 1], 'correct');
  s = judge(setTarget(s, 'team-1', s.cards!['team-1'][3]!, at(10)), 'team-1', 'wrong', at(11));
  expect(saveActive(s, store)).toBe('');
  const back = readActive(store);
  expect(back.error).toBe('');
  expect(back.state).toEqual(s);
  expect(buildSession(back.state!)).toEqual(buildSession(s));
  expect(data.get(BINGO_ACTIVE_KEY)).toBe(JSON.stringify(s));
  data.set(BINGO_ACTIVE_KEY, '{"version":1,"screen":"play"');
  expect(readActive(store)).toEqual({ state: null, error: UNREADABLE });
  expect(saveActive(s, store)).toBe(UNREADABLE);
  expect(data.get(BINGO_ACTIVE_KEY)).toBe('{"version":1,"screen":"play"');
});
