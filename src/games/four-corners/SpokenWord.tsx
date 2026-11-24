import { useState } from 'react';
import { canSpeak, HIDE_WORD, SAY_WORD, SHOW_WORD, speakWord } from './spoken';

/**
 * "Speak" says the word (when the browser can speak) and a small teacher-only "Show word" toggle.
 * The word starts hidden. Render with key={question id} so it hides again on the next question.
 */
export default function SpokenWord({ word, className }: { word: string; className: string }) {
  const [shown, setShown] = useState(false);
  return <div className={className}>
    {canSpeak() && <button className="spoken-say" onClick={() => speakWord(word)}>{SAY_WORD}</button>}
    <button className="spoken-toggle" aria-pressed={shown} onClick={() => setShown(s => !s)}>{shown ? HIDE_WORD : SHOW_WORD}</button>
    {shown && <span className="spoken-peek" data-testid="spoken-peek">{word}</span>}
  </div>;
}
