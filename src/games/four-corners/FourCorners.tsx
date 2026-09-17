import { useEffect, useRef, useState } from 'react';
import { grades } from '../../types';
import { bank, buildQueue, eligible, freshState, gradeLabel, loadState, mixes, roundOptions, saveState, subjectLabel, validSession, type CornerState } from './engine';
import './four-corners.css';

export default function FourCorners({ onHome }: { onHome: () => void }) {
  const [state, setState] = useState(loadState);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'reset' | 'grade' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { title.current?.focus(); }, [state.screen, state.currentRound]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  useEffect(() => {
    const check = () => setState(s => s.screen !== 'setup' && !validSession(s) ? { ...freshState(), grade: s.grade, mix: s.mix, rounds: s.rounds } : s);
    window.addEventListener('storage', check); window.addEventListener('focus', check);
    return () => { window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, []);
  const pool = eligible(state.grade, state.mix);
  const required = state.rounds === 'all' ? 1 : state.rounds;
  const question = bank.find(q => q.id === state.questionIds[state.currentRound]);
  const active = state.screen === 'play' && question;
  function update(patch: Partial<CornerState>) { setState(s => ({ ...s, ...patch })); }
  function start() {
    const available = eligible(state.grade, state.mix);
    const questionIds = buildQueue(available, state.rounds === 'all' ? available.length : state.rounds);
    if (!questionIds.length) return;
    update({ screen: 'play', questionIds, currentRound: 0, usedQuestionIds: [questionIds[0]], revealed: false, endedEarly: false });
  }
  function next() {
    if (!state.revealed) return;
    if (state.currentRound === state.questionIds.length - 1) { update({ screen: 'complete' }); return; }
    const currentRound = state.currentRound + 1;
    update({ currentRound, revealed: false, usedQuestionIds: state.questionIds.slice(0, currentRound + 1) });
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  return <div className={`app fc-app ${active ? 'fc-playing' : ''}`}>
    <header><button className="wordmark" onClick={onHome} aria-label="CurricuPlay home">CURRICU<span>PLAY</span><i /></button>
      <div className="header-actions">{active && state.rounds === 'all' && <button onClick={() => update({ screen: 'complete', endedEarly: true })}>End Game</button>}{state.screen !== 'setup' && <><button onClick={() => setConfirm('grade')}>Change Grade</button><button onClick={() => setConfirm('reset')}>Reset Game</button></>}<button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <p role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</p>}
    {notice && <p role="status" className="warning">{notice}</p>}
    {state.screen === 'setup' && <main className="setup fc-setup">
      <div className="eyebrow">FOUR CORNERS / QUICK SETUP</div><h1 ref={title} tabIndex={-1}>Think. Choose a corner. Learn together.</h1>
      <p className="fc-instructions">Label your gym corners A, B, C, and D. Read, move, then reveal. Everyone stays in the game.</p>
      <fieldset><legend>1 <span>Select grade</span></legend><div className="grade-options">{grades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => update({ grade: g })}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>2 <span>Select question mix</span></legend><div className="fc-mixes">{mixes.map(mix => <button key={mix} aria-pressed={state.mix === mix} onClick={() => update({ mix })}>{mix}</button>)}</div></fieldset>
      <fieldset><legend>3 <span>Select rounds</span></legend><div className="fc-rounds">{roundOptions.map(rounds => <button key={rounds} disabled={pool.length < (rounds === 'all' ? 1 : rounds)} aria-pressed={state.rounds === rounds} onClick={() => update({ rounds })}>{rounds === 'all' ? 'Play Until I Stop' : `${rounds} rounds`}{rounds !== 'all' && pool.length < rounds && <small>Needs {rounds - pool.length} more questions</small>}</button>)}</div></fieldset>
      <div className="setup-bottom"><p><strong>{pool.length} eligible unique questions</strong><br />Content taught through September 13, 2026.</p><button className="primary" disabled={pool.length < required} onClick={start}>Start Game →</button></div>
      {pool.length < required && <p className="content-notice" role="status">{state.mix} has {pool.length} supported questions for {gradeLabel(state.grade)}; {required} {required === 1 ? 'is' : 'are'} needed. {state.mix !== 'Mixed Academic' ? 'Choose Mixed Academic for a balanced game.' : 'Select an available round count.'}</p>}
    </main>}
    {active && <main className="fc-game">
      <div className="fc-meta"><span>{gradeLabel(state.grade)} · {subjectLabel(question.subject)}</span><span>Round {state.currentRound + 1}{state.rounds !== 'all' && ` of ${state.rounds}`}</span></div>
      <div className="fc-prompt"><div>{question.delivery === 'look-at-print' ? <p className="fc-read">LOOK AT THE PRINTED LETTERS · TEACHER READS THE QUESTION ONLY</p> : question.teacherRead && <p className="fc-read">TEACHER READS QUESTION ALOUD</p>}<h1 ref={title} tabIndex={-1}>{question.question}</h1></div>{question.visual && <img src={question.visual.src} alt={question.visual.alt} />}</div>
      <div className="fc-answers">{question.choices.map((choice, index) => <div key={index} className={`fc-choice ${state.revealed && index === question.correctIndex ? 'fc-correct' : ''}`}><b>{'ABCD'[index]}</b><span>{choice}</span>{state.revealed && index === question.correctIndex && <strong className="fc-check">✓ Correct</strong>}</div>)}</div>
      <footer className="fc-controls"><p aria-live="polite">{state.revealed ? `Correct answer: ${'ABCD'[question.correctIndex]}${question.explanation ? ` — ${question.explanation}` : ''}` : 'Choose A, B, C, or D. Everyone stays in the game.'}</p>{state.revealed ? <button className="primary" onClick={next}>{state.rounds !== 'all' && state.currentRound === state.questionIds.length - 1 ? 'Finish Game' : 'Next Question'}</button> : <button className="primary" onClick={() => update({ revealed: true })}>Reveal Answer</button>}</footer>
    </main>}
    {state.screen === 'complete' && <main className="fc-complete"><div className="eyebrow">FOUR CORNERS</div><h1 ref={title} tabIndex={-1}>{state.endedEarly ? 'Game ended.' : state.rounds === 'all' ? 'Every question explored!' : `All ${state.rounds} rounds complete!`}</h1><p>{state.rounds === 'all' && !state.endedEarly ? "You've used every available question in this content pool." : 'Everyone played. Everyone learned.'}</p><button className="primary" onClick={start}>Play Again</button><button onClick={() => update({ screen: 'setup' })}>Change Setup</button></main>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="fc-confirm"><h2 id="fc-confirm">{confirm === 'reset' ? 'Reset this game?' : 'Change grade?'}</h2><p>{confirm === 'reset' ? 'Start a new shuffled game with these settings.' : 'Return to setup and choose a grade. This round’s progress will be cleared.'}</p><div className="dialog-actions"><button onClick={() => setConfirm(null)}>Cancel</button><button className="primary" onClick={() => { if (confirm === 'reset') start(); else setState({ ...freshState(), grade: state.grade, mix: state.mix, rounds: state.rounds }); setConfirm(null); }}>{confirm === 'reset' ? 'Reset Game' : 'Change Grade'}</button></div></dialog>
  </div>;
}
