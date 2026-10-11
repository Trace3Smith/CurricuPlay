import objectPictures from '../../data/spelling-bee-pictures.json' with { type: 'json' };
import { isEvidence, type CurriculumEvidence } from '../../curriculum/eligibility';
import { grades, type Grade } from '../../types';
import raw from '../../data/spelling-bee.json' with { type: 'json' };

export const pictures = {
  plant: { src: '/four-corners/plant.svg', alt: 'A flowering living thing with roots, a stem, and green leaves.' },
  leaf: { src: '/four-corners/plant-leaf.svg', alt: 'An arrow points to a flat green part growing from a stem.' },
  sit: { src: '/spelling-bee/sit.svg', alt: 'A child rests on a chair with knees bent and feet on the floor.' },
  ship: { src: '/spelling-bee/ship.svg', alt: 'A large vessel with several decks and rows of windows travels across the water.' },
  cake: { src: '/spelling-bee/cake.svg', alt: 'A round birthday treat with frosting and lit candles on a plate.' },
  night: { src: '/spelling-bee/night.svg', alt: 'A crescent moon and stars shine in a dark sky above quiet houses.' },
  rain: { src: '/spelling-bee/rain.svg', alt: 'Many drops of water fall from gray clouds into a puddle.' },
  ...objectPictures,
} as const;
export type PictureRef = keyof typeof pictures;
export interface WordEntry {
  id: string; grade: Grade; word: string; clue: string; skill: string;
  picture: PictureRef | null; source: string; kind: 'sample' | 'teacher' | 'curriculum'; reviewStatus: 'approved' | 'pending';
  activity?: 'initial' | 'spelling'; curriculum?: CurriculumEvidence; evidenceId?: string;
  displayWord?: string; // Validated punctuation-only presentation; word remains the canonical answer.
  complexity?: 'foundation' | 'academic';
}
export interface WordList { id: string; name: string; entries: WordEntry[] }
export function isWord(value: unknown): value is WordEntry {
  if (!value || typeof value !== 'object') return false;
  const w = value as WordEntry;
  const text = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max;
  return text(w.id, 100) && grades.includes(w.grade) && typeof w.word === 'string' && /^[a-z]{1,16}$/.test(w.word) &&
    (w.displayWord === undefined || (typeof w.displayWord === 'string' && /^[a-z]+(?:-[a-z]+)+$/.test(w.displayWord) && w.displayWord.replaceAll('-', '') === w.word && w.displayWord.length <= 31)) &&
    text(w.clue, 180) && text(w.skill, 80) && text(w.source, 160) && ['sample', 'teacher', 'curriculum'].includes(w.kind) &&
    ['approved', 'pending'].includes(w.reviewStatus) &&
    (w.activity === undefined || ['initial', 'spelling'].includes(w.activity)) &&
    (w.activity !== 'initial' || (w.grade === 'K' && !!w.picture)) &&
    (w.complexity === undefined || ['foundation', 'academic'].includes(w.complexity)) &&
    (w.curriculum === undefined ? w.kind !== 'curriculum' : isEvidence(w.curriculum) && w.curriculum.grade === w.grade && w.kind === 'curriculum') && (w.picture === null || (typeof w.picture === 'string' && Object.hasOwn(pictures, w.picture)));
}
export function validateWords(value: unknown): { entries: WordEntry[]; errors: string[] } {
  if (!Array.isArray(value) || value.length > 200) return { entries: [], errors: ['Use a list of at most 200 words.'] };
  const errors: string[] = [], seen = new Set<string>(), ids = new Set<string>();
  value.forEach((w, i) => {
    if (!isWord(w)) { errors.push(`Row ${i + 1}: invalid word or metadata.`); return; }
    const key = `${w.grade}:${w.word}`;
    if (seen.has(key) || ids.has(w.id)) errors.push(`Row ${i + 1}: duplicate word or ID.`);
    seen.add(key); ids.add(w.id);
  });
  return { entries: errors.length ? [] : value as WordEntry[], errors };
}
export const samples = validateWords(raw);
/** Plain words, comma-separated words, or one word | clue | skill | picture ID | source per line. */
export function parseWords(input: string, grade: Grade, approved: boolean): ReturnType<typeof validateWords> {
  if (input.length > 60000) return { entries: [], errors: ['Paste at most 60,000 characters.'] };
  const lines = input.trim() ? input.trim().split(input.includes('|') ? /\r?\n/ : /[\r\n,]+/).filter(l => l.trim()) : [];
  const formatErrors: string[] = [];
  const entries = lines.map((line, i) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length > 5) formatErrors.push(`Row ${i + 1}: use at most five fields.`);
    const [word, clue, skill, picture, source] = parts;
    return { id: `custom-${grade}-${i + 1}`, grade, word: word.toLowerCase().replaceAll('-', ''), ...(word.includes('-') ? { displayWord: word.toLowerCase() } : {}),
      clue: clue || 'Listen to the word. Teacher: say the word from your prepared list, or choose Say Word.',
      skill: skill || 'Teacher-selected spelling', picture: picture || null,
      source: source || 'Teacher-provided practice; curriculum alignment not verified', kind: 'teacher', reviewStatus: approved ? 'approved' : 'pending' };
  });
  const checked = validateWords(entries);
  const errors = [...formatErrors, ...checked.errors];
  return { entries: errors.length ? [] : checked.entries, errors };
}
export const difficulties = ['supported', 'missing', 'challenge'] as const;
export type Difficulty = typeof difficulties[number];
/** Keep the middle letter for the full-answer control, even when changing levels. */
export function letterSlots(word: string, difficulty: Difficulty, extraLetters: readonly number[] = []): string[] {
  const reserved = Math.floor(word.length / 2);
  // Short: beginning. Medium: beginning/end. Long: beginning pair/end.
  const anchors = word.length >= 10 ? [0, 1, word.length - 1] : word.length >= 6 ? [0, word.length - 1] : [0];
  return [...word.toUpperCase()].map((c, i) => {
    const show = i !== reserved && (difficulty === 'supported' || (difficulty === 'missing' && anchors.includes(i)) || extraLetters.includes(i));
    return show ? c : '_';
  });
}
/** Split the longest remaining gap, with stable left-to-right tie breaking. */
export function nextHintIndex(word: string, difficulty: Difficulty, extraLetters: readonly number[] = []): number | undefined {
  const slots = letterSlots(word, difficulty, extraLetters);
  const reserved = Math.floor(word.length / 2);
  let best: number[] = [], run: number[] = [];
  for (let i = 0; i <= slots.length; i++) {
    if (slots[i] === '_' && i !== reserved) run.push(i);
    else { if (run.length > best.length) best = run; run = []; }
  }
  return best.length ? best[Math.floor((best.length - 1) / 2)] : undefined;
}

export const answerFor = (word: WordEntry): string => word.activity === 'initial' ? word.word[0] : word.word;
/** Academic vocabulary gets an extra internal anchor, not just length-based support. */
export function startingHints(word: WordEntry, difficulty: Difficulty): number[] {
  if (word.activity === 'initial' || difficulty !== 'missing' || word.complexity !== 'academic') return [];
  const index = nextHintIndex(word.word, difficulty);
  return index === undefined ? [] : [index];
}

/** Historical entries also receive the requested NON-FICTION presentation. */
export const displayedWord = (w: WordEntry): string => w.displayWord ?? (w.word === 'nonfiction' ? 'non-fiction' : w.word);
export function displayedSlots(w: WordEntry, difficulty: Difficulty, extraLetters: readonly number[] = [], revealed = false): string[] {
  const answer = answerFor(w), slots = revealed ? [...answer.toUpperCase()] : letterSlots(answer, difficulty, extraLetters);
  if (w.activity === 'initial') return slots;
  let letter = 0;
  return [...displayedWord(w)].map(c => c === '-' ? '-' : slots[letter++]);
}
