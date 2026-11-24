import { useEffect, useMemo, useRef, useState } from 'react';
import TeamName from '../../assessment/TeamName';
import AssessmentDialog from '../../assessment/AssessmentDialog';
import SessionHistory from '../../assessment/SessionHistory';
import { saveCompletedSession } from '../../assessment/storage';
import { planningAhead, PLANNING_AHEAD } from '../../curriculum/pacing';
import { canSpeak } from '../four-corners/spoken';
import ExerciseTimer from './ExerciseTimer';
import {
  back, bankError, begin, checkLines, checkVowels, current, end, exerciseDurations, keepGoing, lineRules, loadState, MAX_TEAMS, MIN_TEAMS,
  mondayOf, NAME_LIMIT, next, notes, pool, saveState, scores, showLines, showVowels, splitGrades, splitTeamColors, startOver, syllables,
  teamDefaultName, toggleLine, toggleVowel, toLines, toSession, toSetup, winners, wordFor, wordPoints, wrongCheck, type AskedWord, type SplitState, type SplitWord,
} from './engine';
import '../../assessment/assessment.css';
import '../board-mode.css';
import './split-it.css';

const gradeLabel = (g: string) => `Grade ${g}`;
const teamOptions = [0, ...Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => i + MIN_TEAMS)];
const now = () => new Date().toISOString();
const steps: Record<AskedWord['phase'], string> = {
  vowels: 'STEP 1 · UNDERLINE EVERY VOWEL', notes: 'STEP 2 · VOWEL NOTES', lines: 'STEP 3 · TAP THE GAPS TO DRAW THE LINES', done: 'STEP 4 · SAY IT',
};
/** Same voice settings as Spelling Bee: each syllable, then the whole word. */
function speakWord(w: SplitWord) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  for (const text of [...syllables(w), w.word]) {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.8;
    window.speechSynthesis.speak(u);
  }
}
function winnerLine(s: SplitState) {
  const all = scores(s), top = winners(s);
  if (top.length === all.length) return all.length > 1 ? 'It’s a tie between every team!' : `Winner: ${top[0].name}`;
  return top.length > 1 ? `Tie: ${top.map(t => t.name).join(' and ')}` : `Winner: ${top[0].name}`;
}

/** The word as big letter tiles with tappable gaps between them; notes and lines are drawn under and between the tiles. */
function WordTiles({ word: w, asked: a, onLetter, onGap }: { word: SplitWord; asked: AskedWord; onLetter: (i: number) => void; onGap: (after: number) => void }) {
  const letters = [...w.word], n = letters.length;
  const found = a.phase !== 'vowels';
  const underlined = (i: number) => found ? w.underline.includes(i) : a.vowels.includes(i);
  const lines = a.phase === 'done' ? w.splitAfterLetter : a.lines;
  const marks: { from: number; to: number; label: string }[] = found ? [
    ...w.silentE.map(i => ({ from: i, to: i, label: 'silent' })),
    ...w.vowelTeams.map(([x, y]) => ({ from: x, to: y, label: 'team' })),
    ...w.consonantLe.map(([x, y]) => ({ from: x, to: y, label: '+le' })),
    ...(w.yAsVowel ? [{ from: n - 1, to: n - 1, label: 'vowel' }] : []),
  ] : [];
  return <div className="si-word" style={{ '--n': n, gridTemplateColumns: `repeat(${n - 1}, var(--tile) var(--gapw)) var(--tile)` } as React.CSSProperties} data-testid="si-word">
    {letters.map((letter, i) => <span key={i} className="si-cell" style={{ gridColumn: 2 * i + 1 }}>
      {a.phase === 'vowels'
        ? <button className={`si-tile ${underlined(i) ? 'si-underlined' : ''}`} aria-pressed={underlined(i)} aria-label={`Letter ${i + 1}: ${letter}`} onClick={() => onLetter(i)}>{letter}</button>
        : <span className={`si-tile ${underlined(i) ? 'si-underlined' : ''}`} data-letter={i}>{letter}</span>}
    </span>)}
    {letters.slice(0, -1).map((_, i) => {
      const after = i + 1, drawn = lines.includes(after);
      return <span key={`g${after}`} className="si-gap-cell" style={{ gridColumn: 2 * i + 2 }}>
        {a.phase === 'lines'
          ? <button className={`si-gap ${drawn ? 'si-drawn' : ''}`} aria-pressed={drawn} aria-label={`Gap ${after}: between ${letters[i]} and ${letters[i + 1]}`} onClick={() => onGap(after)}><i aria-hidden="true" /></button>
          : <span className={`si-gap ${drawn ? 'si-drawn' : ''}`} data-gap={after}><i aria-hidden="true" /></span>}
      </span>;
    })}
    {marks.map(m => <span key={`${m.label}${m.from}`} className="si-mark" style={{ gridColumn: `${2 * m.from + 1} / ${2 * m.to + 2}` }}>{m.label}</span>)}
  </div>;
}

export default function SplitIt({ onHome, onClassroom }: { onHome: () => void; onClassroom: () => void }) {
  const [state, setState] = useState(loadState);
  const [saved, setSaved] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const available = useMemo(() => state.grade ? pool(state.grade, state.asOf) : [], [state.grade, state.asOf]);
  const asked = current(state);
  const word = asked && wordFor(asked.id);
  const teamMode = state.teamCount > 0;
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { title.current?.focus(); }, [state.screen, state.index, state.exhausted]);
  // Saving is idempotent by session id, so a refresh on the end screen never adds a second copy.
  useEffect(() => { const session = toSession(state); if (session) setHistoryError(saveCompletedSession(session)); }, [state]);
  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { if (canSpeak()) window.speechSynthesis.cancel(); }, [state.index, state.screen, state.exhausted]);

  const change = (f: (s: SplitState) => SplitState) => setState(f);
  function start() {
    if (!state.grade || !available.length) return;
    setHistoryError('');
    setState(s => begin(s, available, crypto.randomUUID(), now()));
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  const teamScores = scores(state);
  const team = asked?.teamId ? state.teams?.find(t => t.id === asked.teamId) : undefined;
  const weekStart = mondayOf(state.asOf);
  const thisWeek = available.filter(w => w.unlocks >= weekStart).length;
  const endButton = <button className="si-end-button" onClick={() => change(s => end(s, now()))}>End</button>;
  const scorebar = teamMode && <div className="si-scorebar" aria-label="Scores">{teamScores.map(t => <span key={t.id} data-testid={`si-score-${t.id}`} className={t.id === asked?.teamId ? 'si-up' : undefined}><TeamName team={t} /> <b>{t.score}</b></span>)}</div>;
  // The first Check decides the point; say so once it has happened.
  const result = (first: boolean | null, label: string) => first === null ? null : <span className={`si-result ${first ? 'si-result-yes' : ''}`}>{label}: {first ? `✓ first try${team ? ` · +1 ${team.name}` : ''}` : 'no point this time'}</span>;

  return <div className={`app si-app board-mode ${state.screen === 'play' ? 'si-playing' : ''}`}>
    <header><button className="wordmark" onClick={onHome} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button>
      <div className="header-actions"><button onClick={onClassroom}>My Classroom</button>{state.screen !== 'play' && <button onClick={() => setHistory(true)}>Session History</button>}<button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <p role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</p>}
    {historyError && <p role="alert" className="warning">{historyError} <button onClick={() => { const session = toSession(state); if (session) setHistoryError(saveCompletedSession(session)); }}>Retry Save</button></p>}
    {notice && <p role="status" className="warning">{notice}</p>}
    {bankError && <p role="alert" className="content-notice">{bankError}</p>}

    {state.screen === 'setup' && <main className="si-setup">
      <div className="eyebrow">SPLIT IT!</div><h1 ref={title} tabIndex={-1}>Find the vowels. Split the word.</h1>
      <fieldset><legend>Grade</legend><div className="si-options si-grades">{splitGrades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => change(s => ({ ...s, grade: g }))}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>Teams</legend><div className="si-options">{teamOptions.map(n => <button key={n} aria-pressed={state.teamCount === n} aria-label={n ? `${n} teams` : 'Teams off'} onClick={() => change(s => ({ ...s, teamCount: n }))}>{n || 'Off'}</button>)}</div></fieldset>
      {teamMode && <fieldset className="si-names"><legend>Team names</legend><div className="si-name-inputs">{Array.from({ length: state.teamCount }, (_, i) => <label key={i}><i className="assessment-team-accent" style={{ backgroundColor: splitTeamColors[i].accent }} aria-hidden="true" /><input aria-label={`Name for team ${i + 1}`} placeholder={teamDefaultName(i)} maxLength={NAME_LIMIT} value={state.names[i]} onChange={e => change(s => ({ ...s, names: s.names.map((x, j) => j === i ? e.target.value : x) }))} /></label>)}</div></fieldset>}
      <fieldset><legend>Movement</legend><div className="si-options">
        <button aria-pressed={state.movement === 0} aria-label="Movement off" onClick={() => change(s => ({ ...s, movement: 0 }))}>Off</button>
        <button aria-pressed={state.movement !== 0} aria-label="Movement on" onClick={() => change(s => ({ ...s, movement: s.movement || 10 }))}>On</button>
        {state.movement !== 0 && exerciseDurations.map(d => <button key={d} className="si-duration" aria-pressed={state.movement === d} aria-label={`Exercise ${d} seconds`} onClick={() => change(s => ({ ...s, movement: d }))}>{d} s</button>)}
      </div></fieldset>
      <div className="si-start"><label>Teaching date <input aria-label="Teaching date" type="date" value={state.asOf} onChange={e => { if (e.target.value) change(s => ({ ...s, asOf: e.target.value })); }} /></label>
        <p role="status">{!state.grade ? 'Choose a grade to start.' : available.length ? `${thisWeek} this week, then ${available.length - thisWeek} review · keeps going until you tap End` : `No words unlocked yet for ${gradeLabel(state.grade)} on this date.`}</p>
        <button className="primary" disabled={!available.length} onClick={start}>Start →</button></div>
      {planningAhead(state.asOf) && <p className="content-notice" role="status" data-testid="planning-ahead">{PLANNING_AHEAD}</p>}
    </main>}

    {state.screen === 'play' && state.exhausted && <main className="si-game si-exhausted">
      <div className="si-stage"><h1 ref={title} tabIndex={-1}>That’s every word for now!</h1><p>{gradeLabel(state.grade!)} has used every word unlocked so far. Start the list over, or end here.</p></div>
      <footer className="si-controls"><button onClick={() => change(back)}>← Back</button><div className="si-controls-main">{endButton}<button className="primary" onClick={() => change(s => startOver(s, available))}>Start the list over</button></div></footer>
      {scorebar}
    </main>}

    {asked && word && <main className="si-game">
      <div className="si-meta"><span data-testid="si-progress">Word {state.index + 1}</span><span>{gradeLabel(state.grade!)}</span>{team && <span className="si-turn" data-testid="si-turn">At the board: <TeamName team={team} /></span>}</div>
      <h1 ref={title} tabIndex={-1} className="si-step">{steps[asked.phase]}</h1>
      <div className="si-stage"><WordTiles word={word} asked={asked} onLetter={i => change(s => toggleVowel(s, i))} onGap={g => change(s => toggleLine(s, g))} /></div>
      <div className="si-info" aria-live="polite">
        {asked.phase === 'vowels' && (wrongCheck(asked) ? <p className="si-feedback" role="status">Not yet. Look again: every a, e, i, o, u, and y at the end of a word.</p> : <p>Tap each vowel letter: a, e, i, o, u, and y at the end of a word. Silent e and the e in -le count too.</p>)}
        {asked.phase === 'notes' && <ul className="si-notes">{notes(word).map(n => <li key={n}>{n}</li>)}</ul>}
        {asked.phase === 'lines' && (wrongCheck(asked) ? <p className="si-feedback" role="status">Not yet. Count the consonants between the vowels.</p> : <p>Tap between letters to draw a line. Tap again to take it away.</p>)}
        {asked.phase === 'done' && <><ul className="si-rules">{lineRules(word).map(r => <li key={r.after}>{r.text}</li>)}</ul><p className="si-syllables" data-testid="si-syllables">{syllables(word).join(' · ')}</p></>}
        {(asked.vowelsFirst !== null || asked.linesFirst !== null) && <p className="si-results">{result(asked.vowelsFirst, 'Vowels')}{result(asked.linesFirst, 'Lines')}</p>}
      </div>
      <footer className="si-controls"><button disabled={state.index === 0 && asked.phase === 'vowels'} onClick={() => change(back)}>← Back</button>
        {state.movement !== 0 && <ExerciseTimer key={asked.key} duration={state.movement} />}
        <div className="si-controls-main">
          {wrongCheck(asked) && <button onClick={() => change(asked.phase === 'vowels' ? showVowels : showLines)}>Show me</button>}
          {asked.phase === 'done' && canSpeak() && <button onClick={() => speakWord(word)}>Speak</button>}
          {endButton}
          {asked.phase === 'vowels' && <button className="primary" onClick={() => change(checkVowels)}>Check vowels</button>}
          {asked.phase === 'notes' && <button className="primary" onClick={() => change(toLines)}>Draw lines →</button>}
          {asked.phase === 'lines' && <button className="primary" onClick={() => change(checkLines)}>Check lines</button>}
          {asked.phase === 'done' && <button className="primary" onClick={() => change(next)}>Next word →</button>}
        </div></footer>
      {scorebar}
    </main>}

    {state.screen === 'complete' && <main className="si-end">
      <h1 ref={title} tabIndex={-1}>Nice splitting!</h1>
      <p className="si-end-count">{state.asked.length} {state.asked.length === 1 ? 'word' : 'words'}</p>
      {teamMode && <section className="si-final" aria-label="Final scores"><p className="si-winner" data-testid="si-winner">{winnerLine(state)}</p>
        <div className="si-final-scores">{teamScores.map(t => <span key={t.id}><TeamName team={t} /> <b>{t.score}</b></span>)}</div></section>}
      <ol className="si-summary">{state.asked.map((a, i) => { const w = wordFor(a.id)!, t = state.teams?.find(x => x.id === a.teamId); return <li key={a.key}><span className="si-summary-meta">{i + 1}{t ? ` · ${t.name}` : ''}{t ? ` · +${wordPoints(a)}` : ''}</span><p>{w.split}</p></li>; })}</ol>
      <div className="si-end-actions"><button className="primary" disabled={!!historyError} onClick={() => setState(toSetup(state))}>New game</button><button onClick={() => change(keepGoing)}>Keep going</button><button onClick={onHome}>Games</button></div>
    </main>}
    {history && <AssessmentDialog onClose={() => setHistory(false)}><SessionHistory /></AssessmentDialog>}
  </div>;
}
