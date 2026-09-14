import { grades, type GameState } from '../types';
import { localDate, validDate } from '../services/curriculumService';
import { readReviews } from '../services/questionReview';
import { classroomQuestions, classroomBank, PACK_CUTOFF } from '../services/classroomPack';
import { createQuestionEngine } from '../services/questionEngine';
import { tiles, isBoardEligible } from '../games/jeopardy/board';
export const STORAGE_KEY = 'curricuplay.game.v1';
export const freshState = (): GameState => ({ version: 1, screen: 'home', selectedGame: null, grade: 'K', range: classroomBank.questions.length ? 'all' : 'recent', asOf: classroomBank.questions.length && localDate() > PACK_CUTOFF ? PACK_CUTOFF : localDate(), usedQuestionIds: [], usedTiles: [], current: null });
export function loadState(): GameState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!s || ![undefined, 'classroom', 'drafts'].includes(s.contentSource) || s.version !== 1 || !grades.includes(s.grade) || !['recent', 'all'].includes(s.range) || !validDate(s.asOf) || !['home', 'setup', 'board', 'question'].includes(s.screen) ||
      ![null, 'jeopardy'].includes(s.selectedGame) || !Array.isArray(s.usedQuestionIds) || !s.usedQuestionIds.every((id: unknown) => typeof id === 'string') ||
      !Array.isArray(s.usedTiles) || !s.usedTiles.every((id: string) => tiles.some(t => t.id === id))) return freshState();
    const decisions = readReviews().decisions;
    const eligible = createQuestionEngine(classroomQuestions(decisions, s.contentSource)).getQuestions({ grade: s.grade, range: s.range, asOf: s.asOf, unused: false });
    if (s.assignments !== undefined && !isBoardEligible(s.assignments, classroomQuestions(decisions, s.contentSource), { grade: s.grade, range: s.range, asOf: s.asOf })) return { ...freshState(), screen: 'setup', contentSource: s.contentSource, grade: s.grade, range: s.range, asOf: s.asOf };
    if (s.current && ((s.assignments && s.assignments[s.current.tileId] !== s.current.questionId) || !eligible.some(q => q.id === s.current.questionId) ||
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
