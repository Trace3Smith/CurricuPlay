import { isBingoState, type BingoState } from './engine';
import { BINGO_ACTIVE_KEY } from './keys';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const UNREADABLE = 'The saved State Lingo Bingo game could not be read. It was left untouched in this browser.';

/** The active save holds the whole event log, so an unfinished game recovers exactly. */
export function readActive(store: Store = localStorage): { state: BingoState | null; error: string } {
  try {
    const raw = store.getItem(BINGO_ACTIVE_KEY);
    if (!raw) return { state: null, error: '' };
    const value = JSON.parse(raw);
    if (!isBingoState(value)) throw Error();
    return { state: value, error: '' };
  } catch { return { state: null, error: UNREADABLE }; }
}
/** Never overwrite a save that cannot be read; the teacher must discard it explicitly. */
export function saveActive(s: BingoState, store: Store = localStorage): string {
  if (!isBingoState(s)) return 'Invalid State Lingo Bingo game.';
  if (readActive(store).error) return UNREADABLE;
  try { store.setItem(BINGO_ACTIVE_KEY, JSON.stringify(s)); return ''; }
  catch { return 'Progress could not be saved. Keep this tab open and retry saving.'; }
}
export function discardActive(store: Store = localStorage): string {
  try { store.removeItem(BINGO_ACTIVE_KEY); return ''; }
  catch { return 'The saved game could not be cleared. Try again.'; }
}
