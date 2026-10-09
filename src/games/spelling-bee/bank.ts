import raw from '../../data/spelling-bee-pacing.json' with { type: 'json' };
import general from '../../data/spelling-bee-general.json' with { type: 'json' };
import { selectCurriculum, type CurriculumSelection } from '../../curriculum/eligibility';
import { isWord, type WordEntry } from './words';

// Fail closed on malformed bundled content; the validator reports the offending row.
export const curriculumBank: WordEntry[] = (raw as unknown[]).every(isWord) ? raw as WordEntry[] : [];
export const generalBank: WordEntry[] = (general as unknown[]).every(isWord) ? general as WordEntry[] : [];
export function selectBank(selection: CurriculumSelection): WordEntry[] {
  const selected = selectCurriculum(selection.mode === 'general' ? generalBank : curriculumBank, selection);
  // The same spelling appearing in two grades is one prompt, favor current-grade evidence.
  const unique = new Map<string, WordEntry>();
  for (const word of selected) {
    if (!unique.has(word.word) || word.grade === selection.grade) unique.set(word.word, word);
  }
  return [...unique.values()];
}
