import { isGameSession, type GameSession } from './engine';
export const HISTORY_KEY = 'curricuplay.sessions.v1';
export interface SessionHistory { sessions: GameSession[]; error: string }
export function readHistory(): SessionHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { sessions: [], error: '' };
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.sessions) || !value.sessions.every((s: unknown) => isGameSession(s) && !!s.endedAt) || new Set(value.sessions.map((s: GameSession) => s.id)).size !== value.sessions.length) throw new Error('Invalid history');
    return { sessions: value.sessions, error: '' };
  } catch { return { sessions: [], error: 'Session History could not be read. Existing stored data has been left untouched.' }; }
}
/** Idempotent write: refresh cannot create a second copy. Never truncate history on error. */
export function saveCompletedSession(session: GameSession): string {
  if (!isGameSession(session) || !session.endedAt) return 'Only a valid completed session can be saved.';
  const history = readHistory();
  if (history.error) return history.error;
  try {
    const sessions = [session, ...history.sessions.filter(s => s.id !== session.id)];
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, sessions }));
    return '';
  } catch { return 'Session History could not be saved. Keep this report open and retry saving.'; }
}
