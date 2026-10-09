import { isBeeState, type BeeState } from './engine';
import { validateWords, type WordList } from './words';
export const ACTIVE_KEY = 'classthread.spelling-bee.active.v1';
export const LISTS_KEY = 'classthread.spelling-bee.lists.v1';
export const HISTORY_KEY = 'classthread.spelling-bee.history.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const message = 'Spelling Bee browser data is unavailable or invalid. Existing data was left untouched.';
export function readActive(store: Store = localStorage): { state: BeeState | null; error: string } {
  try {
    const raw = store.getItem(ACTIVE_KEY);
    if (!raw) return { state: null, error: '' };
    const value = JSON.parse(raw);
    if (!isBeeState(value)) throw Error();
    return { state: value, error: '' };
  } catch { return { state: null, error: message }; }
}
export function readLists(store: Store = localStorage): { lists: WordList[]; error: string } {
  try {
    const raw = store.getItem(LISTS_KEY);
    if (!raw) return { lists: [], error: '' };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.lists) || !data.lists.every((l: WordList) => l && typeof l.id === 'string' && l.id && typeof l.name === 'string' && l.name.trim() && l.name.length <= 60 && !validateWords(l.entries).errors.length) || new Set(data.lists.map((l: WordList) => l.id)).size !== data.lists.length) throw Error();
    return { lists: data.lists, error: '' };
  } catch { return { lists: [], error: message }; }
}
export function readHistory(store: Store = localStorage): { states: BeeState[]; error: string } {
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return { states: [], error: '' };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.states) || !data.states.every((s: unknown) => isBeeState(s) && s.screen === 'complete') || new Set(data.states.map((s: BeeState) => s.session.id)).size !== data.states.length) throw Error();
    return { states: data.states, error: '' };
  } catch { return { states: [], error: message }; }
}
function write(key: string, value: unknown, store: Store): string {
  try { store.setItem(key, JSON.stringify(value)); return ''; }
  catch { return 'Progress could not be saved. Keep this tab open and retry saving.'; }
}
export function saveActive(s: BeeState, store: Store = localStorage): string {
  if (!isBeeState(s)) return 'Invalid Spelling Bee session.';
  const existing = readActive(store);
  if (existing.error) return existing.error;
  return write(ACTIVE_KEY, s, store);
}
export function saveList(list: WordList, store: Store = localStorage): string {
  const current = readLists(store);
  if (current.error) return current.error;
  if (!list.id || !list.name.trim() || list.name.length > 60 || !list.entries.length || validateWords(list.entries).errors.length) return 'Check the list name and words.';
  return write(LISTS_KEY, { version: 1, lists: [list, ...current.lists.filter(l => l.id !== list.id)] }, store);
}
export function saveHistory(s: BeeState, store: Store = localStorage): string {
  const history = readHistory(store);
  if (history.error) return history.error;
  if (!isBeeState(s) || s.screen !== 'complete') return 'Only completed games can be archived.';
  return write(HISTORY_KEY, { version: 1, states: [s, ...history.states.filter(h => h.session.id !== s.session.id)] }, store);
}
