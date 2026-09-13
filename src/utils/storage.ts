import { grades, type GameState } from '../types';
import { localDate, validDate } from '../services/curriculumService';
import { bank } from '../services/questionEngine';
import { tiles } from '../games/jeopardy/board';
export const STORAGE_KEY = 'curricuplay.game.v1';
export const freshState = (): GameState => ({ version: 1, screen: 'home', selectedGame: null, grade: 'K', range: 'recent', asOf: localDate(), usedQuestionIds: [], usedTiles: [], current: null });
export function loadState(): GameState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!s || s.version !== 1 || !grades.includes(s.grade) || !['recent', 'all'].includes(s.range) || !validDate(s.asOf) || !['home', 'setup', 'board', 'question'].includes(s.screen) ||
      ![null, 'jeopardy'].includes(s.selectedGame) || !Array.isArray(s.usedQuestionIds) || !s.usedQuestionIds.every((id: unknown) => typeof id === 'string') ||
      !Array.isArray(s.usedTiles) || !s.usedTiles.every((id: string) => tiles.some(t => t.id === id))) return freshState();
    if (s.current && (!bank.questions.some(q => q.id === s.current.questionId && q.grade === s.grade && q.weekIntroduced <= s.asOf && q.weekIntroduced <= localDate()) ||
      !tiles.some(t => t.id === s.current.tileId && t.category === s.current.category) || typeof s.current.revealed !== 'boolean' || !s.usedTiles.includes(s.current.tileId) || !s.usedQuestionIds.includes(s.current.questionId))) {
      s.current = null; s.screen = 'board';
    }
    if (s.screen === 'question' && !s.current) s.screen = 'board';
    return s;
  } catch { return freshState(); }
}
export function saveState(state: GameState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
