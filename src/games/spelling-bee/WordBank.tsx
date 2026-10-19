import { useState } from 'react';
import { grades, type Grade } from '../../types';
import { schoolDate, validSchoolDate, type ContentMode, type CurriculumSelection } from '../../curriculum/eligibility';
import { currentWindow, pacingStatus, planningAhead, PLANNING_AHEAD, shortDate, taughtDate } from '../../curriculum/pacing';
import { difficulties, displayedWord, parseWords, pictures, type Difficulty, type WordEntry } from './words';
import { selectBank } from './bank';
import { readLists, saveList } from './storage';
import type { StartOptions } from './engine';

const modeNames: Partial<Record<ContentMode, string>> = {
  current: 'Current', review: 'Review', mixed: 'Current + Review', general: 'Teacher-Created / General Practice',
};
export default function WordBank({ onStart, fixed, onCancel }: {
  onStart: (words: WordEntry[], grade: Grade, difficulty: Difficulty, options: StartOptions) => void;
  fixed?: { grade: Grade; cutoff: string }; onCancel?: () => void;
}) {
  const [grade, setGrade] = useState<Grade>(fixed?.grade ?? 'K');
  const [cutoff, setCutoff] = useState(() => fixed?.cutoff ?? schoolDate());
  const [mode, setMode] = useState<ContentMode>('mixed');
  const [priorGrade, setPriorGrade] = useState(false);
  const [untilStop, setUntilStop] = useState(true);
  const [choices, setChoices] = useState<0 | 2 | 3>(0);
  const [activity, setActivity] = useState<'initial' | 'spelling'>('initial');
  const [difficulty, setDifficulty] = useState<Difficulty>('supported');
  const [savedLists, setSavedLists] = useState(readLists);
  const [selection, setSelection] = useState('sample');
  const [name, setName] = useState('My spelling list');
  const [input, setInput] = useState('');
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewPage, setPreviewPage] = useState(0);
  const config: CurriculumSelection = { grade, cutoff, mode, priorGrade: Number(grade) >= 2 && priorGrade };
  const parsed = parseWords(input, grade, approved);
  const custom = mode === 'general' && selection !== 'sample';
  const bank = custom ? (selection === 'custom' ? parsed.entries : savedLists.lists.find(l => l.id === selection)?.entries ?? []).filter(w => w.grade === grade) : selectBank(config);
  // Legacy teacher lists remain whole-word lists in storage. Activity is a new-session choice.
  const words = bank.map(w => grade === 'K' && mode === 'general' ? { ...w, activity, clue: activity === 'initial' ? 'What letter does this object start with?' : w.clue } : w);
  const ready = words.filter(w => w.reviewStatus === 'approved');
  const missingPictures = words.some(w => w.activity === 'initial' && (!w.picture || !pictures[w.picture]));
  const errors = custom && selection === 'custom' ? parsed.errors : [];
  const beginning = grade === 'K' && (mode !== 'general' || activity === 'initial');
  const range = currentWindow(cutoff);
  const counts = { direct: ready.filter(w => w.curriculum?.category === 'source-listed').length, practice: ready.filter(w => w.curriculum?.category === 'skill-practice').length, prior: ready.filter(w => w.grade !== grade).length };
  function resetReview() { setApproved(false); setNotice(''); setPreviewPage(0); }
  function save() {
    const error = saveList({ id: crypto.randomUUID(), name: name.trim(), entries: parsed.entries });
    setNotice(error || 'List saved on this browser. Select it any time to reuse it.');
    if (!error) setSavedLists(readLists());
  }
  return <main className="bee-setup">
    <div><p className="eyebrow">GAME 03 / SPELLING BEE</p><h1>{beginning ? 'See it. Say it. Find its first letter.' : 'Collect letters. Build a word.'}</h1><p>Six teams · One shared prompt · One point per correct team</p></div>
    <div className="bee-setup-grid"><section className="bee-panel">
      <h2>{fixed ? 'Add prompts at the same date' : 'Set up your class'}</h2>
      <div className="bee-field-row">
        <label>Grade<select aria-label="Grade" disabled={!!fixed} value={grade} onChange={e => { const g = e.target.value as Grade; setGrade(g); setDifficulty(['K', '1', '2'].includes(g) ? 'supported' : 'missing'); resetReview(); }}>{grades.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}</select></label>
        <label>Teaching date<input aria-label="Teaching date" type="date" disabled={!!fixed} value={cutoff} onChange={e => { setCutoff(e.target.value); resetReview(); }} /></label>
      </div>
      {!fixed && <button className="bee-small-button" onClick={() => { setCutoff(schoolDate()); resetReview(); }}>Use today in America/New_York</button>}
      {planningAhead(cutoff) && <p role="status" data-testid="planning-ahead">{PLANNING_AHEAD}</p>}
      <label>Content mode<select aria-label="Content mode" value={mode} onChange={e => { setMode(e.target.value as ContentMode); resetReview(); }}>{Object.entries(modeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {mode !== 'general' ? <p className="bee-muted" data-testid="bee-pacing-window">{range ? <>Current = taught {shortDate(range.start)} – {shortDate(range.end)} (newest first). Review = taught before {shortDate(range.start)}.</> : 'Choose a valid date.'} Week-only evidence counts as taught on that week’s Friday. Scheduled instruction, not confirmed completion; later items stay hidden.</p> : <label>Word bank<select aria-label="Word bank" value={selection} onChange={e => { setSelection(e.target.value); resetReview(); }}><option value="sample">Sample practice · not district vocabulary</option><option value="custom">Enter or paste a new list</option>{savedLists.lists.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>}
      {mode === 'mixed' && Number(grade) >= 2 && <label className="bee-check"><input type="checkbox" checked={priorGrade} onChange={e => { setPriorGrade(e.target.checked); resetReview(); }} />Include Prior-Grade Review (one grade earlier, same date)</label>}
      {grade === 'K' && mode === 'general' && <label>Kindergarten activity<select aria-label="Kindergarten activity" value={activity} onChange={e => { setActivity(e.target.value as typeof activity); resetReview(); }}><option value="initial">Beginning letter · picture required</option><option value="spelling">Optional whole-word spelling</option></select></label>}
      {beginning ? <label>Letter choices<select aria-label="Letter choices" value={choices} onChange={e => setChoices(Number(e.target.value) as 0 | 2 | 3)}><option value={0}>No choices · one blank answer</option><option value={2}>Two choices</option><option value={3}>Three choices</option></select></label> : <label>Letter hints<select aria-label="Letter hints" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>{difficulties.map(d => <option key={d} value={d}>{d === 'supported' ? 'Supported · one missing letter' : d === 'missing' ? 'Missing letters · adaptive anchors' : 'Full-word challenge · no letters'}</option>)}</select></label>}
      {!fixed && <label>Session length<select aria-label="Session length" value={untilStop ? 'continuous' : 'cycle'} onChange={e => setUntilStop(e.target.value === 'continuous')}><option value="continuous">Play Until I Stop</option><option value="cycle">One cycle · finish when bank ends</option></select></label>}
      <p role="status">{ready.length} approved prompts · {counts.direct} source-listed · {counts.practice} skill practice{counts.prior ? ` · ${counts.prior} Prior-Grade Review` : ''}</p>
      <label className="bee-check"><input aria-label="Teacher approval" type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />I reviewed these prompts, pictures, and skills for my class. Scheduled instruction does not confirm learning.</label>
      <div className="bee-actions"><button className="primary" disabled={!approved || !ready.length || !!errors.length || missingPictures || !validSchoolDate(cutoff)} onClick={() => onStart(ready, grade, difficulty, { selection: config, untilStop: fixed ? true : untilStop, reviewed: approved, choices })}>{fixed ? 'Add Reviewed Prompts' : 'Start Game'}</button>{onCancel && <button onClick={onCancel}>Back to Game</button>}</div>
    </section><section className="bee-panel">
      {custom && selection === 'custom' ? <>
        <h2>Your word list</h2><label>List name<input aria-label="List name" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Words<textarea aria-label="Words" aria-describedby="bee-format" value={input} maxLength={60000} onChange={e => { setInput(e.target.value); resetReview(); }} placeholder={'cat | A pet that says meow. | CVC short a | cat\nsun | It shines in the sky. | CVC short u | sun'} /></label>
        <p id="bee-format" className="bee-muted">Paste words separated by lines or commas. For clues: word | clue | skill | picture ID | source. Use 1–16 English letters, with optional hyphens; up to 200 words. Kindergarten beginning-letter prompts need a matching picture.</p>
        <details><summary>Available picture IDs</summary><p className="bee-muted">{Object.keys(pictures).join(', ')}</p></details>
        <button disabled={!name.trim() || !parsed.entries.length || !!errors.length || !!savedLists.error} onClick={save}>Save List</button>
        {!!errors.length && <p role="alert">{errors.slice(0, 2).join(' ')}</p>}
      </> : <>
        <h2>Teacher preparation</h2>
        <p>{beginning ? 'Show the object and choose Say Word. Students identify its beginning letter. The full object name stays off the live board until you reveal the answer.' : 'Read the clue or choose Say Word. Teams write the word or build it with letter tiles. Adjust hints as needed.'}</p>
        <p>{grade === 'K' ? 'Mark correct teams and Commit Results whenever you are ready. Each correct team earns one point.' : 'Choose a round duration (default 5:00), then Start Timer. After time expires, mark correct teams and Commit Results. Use Teacher: End Round Early if needed.'} Reveal the answer when you choose. Scores reflect team responses only.</p>
        <p className="bee-muted">Source-listed means the term appears in district instructional material, not necessarily an assigned spelling list. Skill practice uses ClassThread-authored examples and clues. General practice is not verified against pacing.</p>
        <details className="bee-preview"><summary>Teacher: preview prompts and evidence</summary>
          <div className="bee-bank-preview">{words.slice(previewPage * 5, previewPage * 5 + 5).map(w => <article key={w.id}><strong>{displayedWord(w).toUpperCase()}{w.activity === 'initial' ? ` → ${w.word[0].toUpperCase()}` : ''}</strong> · {w.grade !== grade ? `Prior-Grade Review (${w.grade}) · ` : ''}{w.curriculum?.category ?? 'general practice'}<p>{w.clue}</p>{w.curriculum && <p><a href={w.curriculum.sourceUrl} target="_blank" rel="noreferrer">{w.curriculum.source}</a> · {w.curriculum.unit} · taught {taughtDate(w.curriculum) ?? 'not scheduled'}{pacingStatus(taughtDate(w.curriculum), cutoff) === 'review' ? ' · Review' : pacingStatus(taughtDate(w.curriculum), cutoff) === 'current' ? ' · Current' : ''}<br />{w.curriculum.target}</p>}{w.picture && <img src={pictures[w.picture].src} alt={`Teacher preview: ${w.word}`} />}</article>)}</div>
          <div className="bee-actions"><button disabled={!previewPage} onClick={() => setPreviewPage(p => p - 1)}>Previous prompts</button><button disabled={(previewPage + 1) * 5 >= words.length} onClick={() => setPreviewPage(p => p + 1)}>More prompts</button></div>
        </details>
        <details className="bee-preview"><summary>Optional PE directions</summary><p>Set up six scooter lanes. One rider per team collects one letter per trip; teams build the answer at their station. Rotate riders at your signal.</p></details>
        {custom && <button onClick={() => { const list = savedLists.lists.find(l => l.id === selection); if (!list) return; setName(`${list.name.slice(0, 50)} (copy)`); setInput(list.entries.filter(w => w.grade === grade).map(w => [displayedWord(w), w.clue, w.skill, w.picture || '', w.source].join(' | ')).join('\n')); resetReview(); setSelection('custom'); }}>Edit a Copy</button>}
      </>}
      {!ready.length && <p role="status">No approved prompts for this selection. Try Current + Review, another date, or explicit General Practice. Future and uncertain content will not be added.</p>}
      {grade === 'K' && mode !== 'general' && <p className="bee-muted">Kindergarten Unit 2 dates conflict between the overview and weekly calendar. Those letters are excluded. Unit 1 picture practice remains available as review.</p>}
      {missingPictures && <p role="alert">Each beginning-letter prompt needs a matching reviewed picture. Add a picture ID or choose optional whole-word spelling.</p>}
      {words.some(w => w.reviewStatus === 'pending') && <p>Saved draft: choose Edit a Copy and approve it before play.</p>}
      {(notice || savedLists.error) && <p role="status">{notice || savedLists.error}</p>}
    </section></div>
  </main>;
}
