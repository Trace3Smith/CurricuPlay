/**
 * Spoken-target rounds (Four Corners and Quick Check): the teacher says a word and children run to it.
 * The word is never printed outside the four choices, which all look the same until Reveal, so children
 * must recognise the word they hear instead of matching letters on the screen.
 * scripts/validate-paced-batch.py repeats these labels; keep the two in step.
 */
// Labels use no word from the Kindergarten sight-word list ("the", "to", "a"… are all on it).
export const SPOKEN_BANNER = 'LISTEN!';
export const SAY_WORD = 'Speak';
export const SHOW_WORD = 'Show word';
export const HIDE_WORD = 'Hide word';
/** Four Corners' hint line on spoken rounds (the usual "Choose A, B, C, or D…" prints "or" and "in"). */
export const SPOKEN_HINT = 'Listen. Run. Reveal.';
/** Team Mode before Reveal (the usual line prints "the" and "to"). */
export const SPOKEN_SCORING = 'Reveal answer. Mark correct teams.';
/** Movement timer on spoken rounds (the usual text prints "to", "your", "at", "the", "when", "time"…). */
export const SPOKEN_TIMER = { count: 'STOP!', running: 'MOVE!', expired: 'STOP!', idle: 'MOVEMENT TIMER', reset: 'Timer reset.', reveal: 'Teacher: reveal answer.', ready: 'Silent countdown.', unsaved: 'Timer save failed.' };
/** Every label a spoken round can print outside the four choices (buttons such as Start / Cancel Timer / End Game too). */
export const spokenScreenText = [SPOKEN_BANNER, SAY_WORD, SHOW_WORD, HIDE_WORD, SPOKEN_HINT, SPOKEN_SCORING, ...Object.values(SPOKEN_TIMER)];
const screenLabels = spokenScreenText;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole word, ignoring case: "a" is in "Run to a word", not in "Listen". */
export const containsWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}'’])${escape(word.trim())}($|[^\\p{L}\\p{N}'’])`, 'iu').test(text);

/** A spoken target must be the answer, appear once among the choices, and never be printed anywhere else on screen. */
export function spokenTargetOk(q: { question: string; choices: readonly string[]; correctIndex: number; spokenTarget?: unknown }): boolean {
  if (q.spokenTarget === undefined) return true;
  const word = q.spokenTarget;
  return typeof word === 'string' && !!word.trim() && q.choices[q.correctIndex] === word && q.choices.filter(c => c === word).length === 1 &&
    ![q.question, ...screenLabels].some(text => containsWord(text, word));
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
/** Same voice settings as Spelling Bee. */
export function speakWord(word: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word); utterance.lang = 'en-US'; utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}
