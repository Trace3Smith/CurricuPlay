/** Which game was opened last, so the Games hub can spotlight it. Browser-only and separate from every game's own save. */
export const LAST_OPENED_KEY = 'classthread.games.last-opened.v1';
export type HubGame = 'jeopardy' | 'four-corners' | 'spelling-bee' | 'state-lingo-bingo';
const hubGames: readonly HubGame[] = ['jeopardy', 'four-corners', 'spelling-bee', 'state-lingo-bingo'];

/** Maps a game route such as /games/spelling-bee to its game; other paths (the hub, Question Review) return null. */
export const gameForPath = (path: string): HubGame | null => hubGames.find(game => path === `/games/${game}`) ?? null;

// The spotlight is optional, so unavailable or blocked storage is ignored rather than reported.
export function recordOpened(game: HubGame, storage: Pick<Storage, 'setItem'> = localStorage, now = new Date()) {
  try { storage.setItem(LAST_OPENED_KEY, JSON.stringify({ version: 1, game, at: now.toISOString() })); } catch { /* optional */ }
}
export function readLastOpened(storage: Pick<Storage, 'getItem'> = localStorage): HubGame | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(LAST_OPENED_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const { version, game } = value as { version?: unknown; game?: unknown };
    return version === 1 && hubGames.includes(game as HubGame) ? game as HubGame : null;
  } catch { return null; }
}

/** The one saved game to spotlight: the last-opened one if it is saved, else the only saved game, else none. */
export function spotlightGame(saved: readonly HubGame[], lastOpened: HubGame | null): HubGame | null {
  if (lastOpened && saved.includes(lastOpened)) return lastOpened;
  return saved.length === 1 ? saved[0] : null;
}
