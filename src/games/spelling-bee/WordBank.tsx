import { useState } from 'react';
import { grades, type Grade } from '../../types';
import { difficulties, parseWords, pictures, samples, type Difficulty, type WordEntry } from './words';
import { readLists, saveList } from './storage';
export default function WordBank({ onStart }: { onStart: (words: WordEntry[], grade: Grade, difficulty: Difficulty) => void }) {
  const [grade, setGrade] = useState<Grade>('K');
  const [difficulty, setDifficulty] = useState<Difficulty>('supported');
  const [savedLists, setSavedLists] = useState(readLists);
  const [selection, setSelection] = useState('sample');
  const [name, setName] = useState('My spelling list');
  const [input, setInput] = useState('');
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState('');
  const parsed = parseWords(input, grade, approved);
  const words = (selection === 'sample' ? samples.entries : selection === 'custom' ? parsed.entries : savedLists.lists.find(l => l.id === selection)?.entries ?? []).filter(w => w.grade === grade);
  const ready = words.filter(w => w.reviewStatus === 'approved');
  const errors = selection === 'sample' ? samples.errors : selection === 'custom' ? parsed.errors : [];
  function save() {
    const id = crypto.randomUUID();
    const error = saveList({ id, name: name.trim(), entries: parsed.entries });
    setNotice(error || 'List saved on this browser. Select it any time to reuse it.');
    if (!error) { setSavedLists(readLists()); setSelection(id); }
  }
  return <main className="bee-setup">
    <div><p className="eyebrow">GAME 03 / SPELLING BEE</p><h1>Collect letters. Build a word.</h1><p>Six teams · One shared word · One point per correct team</p></div>
    <div className="bee-setup-grid"><section className="bee-panel">
      <h2>Set up your class</h2>
      <label>Grade<select aria-label="Grade" value={grade} onChange={e => { const g = e.target.value as Grade; setGrade(g); setDifficulty(['K', '1', '2'].includes(g) ? 'supported' : 'missing'); setApproved(false); }}>{grades.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}</select></label>
      <label>Letter hints<select aria-label="Letter hints" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>{difficulties.map(d => <option key={d} value={d}>{d === 'supported' ? 'Supported · one missing letter (C _ T)' : d === 'missing' ? 'Missing letters · 1–3 anchor letters by word length' : 'Full-word challenge · no letters (_ _ _)'}</option>)}</select></label>
      <label>Word bank<select aria-label="Word bank" value={selection} onChange={e => { setSelection(e.target.value); setNotice(''); }}><option value="sample">Sample practice · not district vocabulary</option><option value="custom">Enter or paste a new list</option>{savedLists.lists.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
      <p>{ready.length} approved words for this grade. Words will be shuffled without repetition.</p>
      <p className="bee-muted">Sample words are general practice suggestions. No verified current or previously taught district spelling list is included.</p>
      <button className="primary" disabled={!ready.length || !!errors.length} onClick={() => onStart(ready, grade, difficulty)}>Start Game</button>
      {!ready.length && <p role="status">No approved words for this selection. Choose sample practice, another grade, or review a custom list.</p>}
    </section><section className="bee-panel">
      {selection === 'custom' ? <>
        <h2>Your word list</h2><label>List name<input aria-label="List name" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Words<textarea aria-label="Words" aria-describedby="bee-format" value={input} maxLength={60000} onChange={e => { setInput(e.target.value); setApproved(false); }} placeholder={'cat | A pet that says meow. | CVC short a | cat\nsun | It shines in the sky. | CVC short u | sun'} /></label>
        <p id="bee-format">Paste words separated by lines or commas. For clues: word | clue | skill | picture ID | source. Optional picture IDs: {Object.keys(pictures).join(', ')}. Use 1–16 English letters per word; up to 200 words.</p>
        <label className="bee-check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />I reviewed these words, clues, pictures, and grade suitability for my class.</label>
        <button disabled={!name.trim() || !parsed.entries.length || !!parsed.errors.length || !!savedLists.error} onClick={save}>Save List</button>
        {errors.length > 0 && <p role="alert">{errors.slice(0, 2).join(' ')}{errors.length > 2 ? ` Plus ${errors.length - 2} more errors.` : ''}</p>}
      </> : <>
        <h2>Teacher preparation</h2><ol><li>Teams can write words or build them with letter tiles.</li><li>Read the clue aloud. Everyone solves the same word. Offer letter hints or say the word as needed.</li><li>Mark correct teams, then commit results. Reveal the answer when you choose.</li></ol>
        <details className="bee-preview"><summary>Optional PE directions</summary><p>Set up six scooter lanes. One rider per team collects one letter per trip; teams build the word at their station. Rotate riders at your signal.</p></details>
        <p className="bee-muted">If using letter tiles, prepare enough for six teams, including repeated letters.</p>
        <details className="bee-preview"><summary>Teacher: preview word list</summary><p>{words.slice(0, 20).map(w => w.word).join(', ') + (words.length > 20 ? ` … and ${words.length - 20} more` : '') || 'No words in this grade.'}</p></details>
        {selection !== 'sample' && <button onClick={() => { const list = savedLists.lists.find(l => l.id === selection); if (!list) return; setName(`${list.name.slice(0, 50)} (copy)`); setInput(list.entries.filter(w => w.grade === grade).map(w => [w.word, w.clue, w.skill, w.picture || '', w.source].join(' | ')).join('\n')); setApproved(false); setSelection('custom'); }}>Edit a Copy</button>}
        {words.some(w => w.reviewStatus === 'pending') && <p>Saved draft: approval is required. Choose Edit a Copy and review the list to play.</p>}
      </>}
      {(notice || savedLists.error) && <p role="status">{notice || savedLists.error}</p>}
    </section></div>
  </main>;
}
