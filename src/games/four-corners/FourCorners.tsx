import MovementTimer from './MovementTimer';
import { movementDuration, movementDurations, type MovementDuration } from './movementTimer';
import TeamName from '../../assessment/TeamName';
import { presentCornerSession } from './teams';
import { useEffect, useRef, useState } from 'react';
import AssessmentView from '../../assessment/AssessmentView';
import AssessmentDialog from '../../assessment/AssessmentDialog';
import SessionHistory from '../../assessment/SessionHistory';
import { summarizeSession } from '../../assessment/engine';
import { saveCompletedSession } from '../../assessment/storage';
import { grades } from '../../types';
import { bank, buildQueue, beginGame, advanceRound, finishEarly, isTeamMode, toggleCorrectTeam, eligible, freshState, gradeLabel, loadState, mixes, roundOptions, saveState, subjectLabel, validSession, type CornerState } from './engine';
import './four-corners.css';

// Printed-letter rounds label the corners with shapes instead of letters. On those questions the
// choices are themselves letters, and a five-year-old cannot reliably tell the letter naming the
// corner from the letter being asked about. Every other question keeps plain A/B/C/D.
const CORNER_TOKENS = ['\u25cf', '\u25b2', '\u25a0', '\u25c6'];
const isPrintRound = (delivery?: string) => delivery === 'look-at-print';

export default function FourCorners({ onHome }: { onHome: () => void }) {
  const [state, setState] = useState(loadState);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'reset' | 'grade' | 'end' | null>(null);
  const [panel, setPanel] = useState<'live' | 'history' | null>(null);
  const [historyError, setHistoryError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { if (state.session?.endedAt) setHistoryError(saveCompletedSession(state.session)); }, [state.session]);
  useEffect(() => { title.current?.focus(); }, [state.screen, state.currentRound]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  useEffect(() => {
    const check = () => setState(s => s.screen !== 'setup' && !validSession(s) ? { ...freshState(), grade: s.grade, mix: s.mix, rounds: s.rounds, mode: s.mode ?? 'classic', teamCount: s.teamCount ?? 6, movementDuration: movementDuration(s.movementDuration) } : s);
    window.addEventListener('storage', check); window.addEventListener('focus', check);
    return () => { window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, []);
  const pool = eligible(state.grade, state.mix);
  const required = state.rounds === 'all' ? 1 : state.rounds;
  const question = bank.find(q => q.id === state.questionIds[state.currentRound]);
  const active = state.screen === 'play' && question;
  const teamMode = isTeamMode(state);
  const timerSeconds = movementDuration(state.movementDuration);
  const timerKey = `${state.session?.id ?? 'legacy'}:${question?.id ?? ''}`;
  const displaySession = state.session ? presentCornerSession(state.session) : undefined;
  const assessment = displaySession ? summarizeSession(displaySession) : null;
  function update(patch: Partial<CornerState>) { setState(s => ({ ...s, ...patch })); }
  function start() {
    const available = eligible(state.grade, state.mix);
    const questionIds = buildQueue(available, state.rounds === 'all' ? available.length : state.rounds);
    if (!questionIds.length) return;
    setState(beginGame(state, questionIds, crypto.randomUUID(), new Date().toISOString()));
    setHistoryError('');
  }
  function next() { setState(s => advanceRound(s, new Date().toISOString())); }
  function confirmAction() {
    const now = new Date().toISOString();
    if (confirm === 'end') setState(s => finishEarly(s, now));
    else {
      // Preserve committed work before resetting or changing grade.
      if (state.session) {
        const error = saveCompletedSession(state.session.endedAt ? state.session : finishEarly(state, now).session!);
        if (error) { setHistoryError(error); setConfirm(null); return; }
      }
      if (confirm === 'reset') start();
      else setState({ ...freshState(), grade: state.grade, mix: state.mix, rounds: state.rounds, mode: state.mode ?? 'classic', teamCount: state.teamCount ?? 6, movementDuration: movementDuration(state.movementDuration) });
    }
    setConfirm(null);
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  return <div className={`app fc-app ${active ? 'fc-playing' : ''} ${active && teamMode ? 'fc-team-playing' : ''}`}>
    <header><button className="wordmark" onClick={onHome} aria-label="CurricuPlay home">CURRICU<span>PLAY</span><i /></button>
      <div className="header-actions">{active && <><button onClick={() => setConfirm('end')}>End Game</button>{teamMode && <button onClick={() => setPanel('live')}>Assessment</button>}</>}{!active && <button onClick={() => setPanel('history')}>Session History</button>}{state.screen !== 'setup' && <><button onClick={() => setConfirm('grade')}>Change Grade</button><button onClick={() => setConfirm('reset')}>Reset Game</button></>}<button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <p role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</p>}
    {historyError && <p role="alert" className="warning">{historyError} {state.session?.endedAt && <button onClick={() => setHistoryError(saveCompletedSession(state.session!))}>Retry Save</button>}</p>}
    {notice && <p role="status" className="warning">{notice}</p>}
    {state.screen === 'setup' && <main className="setup fc-setup">
      <div className="eyebrow">FOUR CORNERS / QUICK SETUP</div><h1 ref={title} tabIndex={-1}>Think. Choose a corner. Learn together.</h1>
      <p className="fc-instructions">Label your gym corners A, B, C, and D. Read, move, then reveal. Everyone stays in the game.</p>
      <fieldset className="fc-mode"><legend>Game mode</legend><div className="fc-mode-options"><button aria-pressed={teamMode} onClick={() => update({ mode: 'team', rounds: 'all', teamCount: state.teamCount ?? 6 })}>Team Mode · Recommended for PE</button><button aria-pressed={!teamMode} onClick={() => update({ mode: 'classic', rounds: 15 })}>Classic Mode</button>{teamMode && <label>Teams <select aria-label="Team count" value={state.teamCount ?? 6} onChange={e => update({ teamCount: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}{teamMode && <label>Movement timer <select aria-label="Movement timer duration" value={timerSeconds} onChange={e => update({ movementDuration: Number(e.target.value) as MovementDuration })}>{movementDurations.map(seconds => <option key={seconds} value={seconds}>{seconds === 0 ? 'Off' : `${seconds} seconds`}</option>)}</select></label>}</div><p>{teamMode ? 'One runner per team. Answer independently—no team discussion. Correct = 1 point. Teacher rotates runners; no names stored.' : 'Whole-class movement. No team scoring required.'}</p></fieldset>
      <fieldset><legend>1 <span>Select grade</span></legend><div className="grade-options">{grades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => update({ grade: g })}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>2 <span>Select question mix</span></legend><div className="fc-mixes">{mixes.map(mix => <button key={mix} aria-pressed={state.mix === mix} onClick={() => update({ mix })}>{mix}</button>)}</div></fieldset>
      <fieldset><legend>3 <span>Select rounds</span></legend><div className="fc-rounds">{roundOptions.map(rounds => <button key={rounds} disabled={pool.length < (rounds === 'all' ? 1 : rounds)} aria-pressed={state.rounds === rounds} onClick={() => update({ rounds })}>{rounds === 'all' ? 'Play Until I Stop' : `${rounds} rounds`}{rounds !== 'all' && pool.length < rounds && <small>Needs {rounds - pool.length} more questions</small>}</button>)}</div></fieldset>
      <div className="setup-bottom"><p><strong>{pool.length} eligible unique questions</strong><br />Content taught through September 13, 2026.</p><button className="primary" disabled={pool.length < required} onClick={start}>Start Game →</button></div>
      {pool.length < required && <p className="content-notice" role="status">{state.mix} has {pool.length} supported questions for {gradeLabel(state.grade)}; {required} {required === 1 ? 'is' : 'are'} needed. {state.mix !== 'Mixed Academic' ? 'Choose Mixed Academic for a balanced game.' : 'Select an available round count.'}</p>}
    </main>}
    {active && teamMode && <div className="fc-scoreboard" aria-label="Live scoreboard">{assessment?.teams.map(t => <span key={t.id} data-testid={`score-${t.id}`}><TeamName team={t} /> <b>{t.score + ((state.correctTeamIds ?? []).includes(t.id) ? 1 : 0)}</b></span>)}<small>{state.revealed ? 'Round marks pending Next Question' : 'LOOK → THINK → RUN → REVEAL → SCORE → ROTATE → NEXT'}</small></div>}
    {active && <main className="fc-game">
      <div className="fc-meta"><span>{gradeLabel(state.grade)} · {subjectLabel(question.subject)}</span><span>Round {state.currentRound + 1}{state.rounds !== 'all' && ` of ${state.rounds}`}</span></div>
      <div className="fc-prompt"><div>{question.delivery === 'look-at-print' ? <p className="fc-read">LOOK AT THE PRINTED LETTERS · TEACHER READS THE QUESTION ONLY</p> : question.teacherRead && <p className="fc-read">TEACHER READS QUESTION ALOUD</p>}<h1 ref={title} tabIndex={-1}>{question.question}</h1></div>{question.visual && <img src={question.visual.src} alt={question.visual.alt} />}</div>
      <div className="fc-answers">{question.choices.map((choice, index) => <div key={index} className={`fc-choice ${isPrintRound(question.delivery) ? 'fc-choice-print' : ''} ${state.revealed && index === question.correctIndex ? 'fc-correct' : ''}`}>{isPrintRound(question.delivery)
        ? <b className="fc-corner"><i className="fc-token" aria-hidden="true">{CORNER_TOKENS[index]}</i>Corner {'ABCD'[index]}</b>
        : <b>{'ABCD'[index]}</b>}<span className={isPrintRound(question.delivery) ? 'fc-letter' : undefined}>{choice}</span>{state.revealed && index === question.correctIndex && <strong className="fc-check">✓ Correct</strong>}</div>)}</div>
      {teamMode && timerSeconds > 0 && !state.revealed ? <MovementTimer key={timerKey} roundKey={timerKey} duration={timerSeconds} /> : teamMode && <section className="fc-round-scoring" aria-label="Score this round"><div><strong>{state.revealed ? 'Mark every correct team. Tap again to undo.' : 'Reveal the answer to mark correct teams.'}</strong>{state.revealed && <button onClick={() => update({ correctTeamIds: [] })}>Clear Round</button>}</div><div className="fc-team-buttons">{displaySession?.teams.map(t => <button key={t.id} disabled={!state.revealed} aria-pressed={(state.correctTeamIds ?? []).includes(t.id)} onClick={() => setState(s => toggleCorrectTeam(s, t.id))}><TeamName team={t} />{(state.correctTeamIds ?? []).includes(t.id) ? ' ✓ +1' : ''}</button>)}</div></section>}
      <footer className="fc-controls"><p aria-live="polite">{state.revealed ? <>{'Correct answer: '}{isPrintRound(question.delivery) && <i className="fc-token fc-token-inline" aria-hidden="true">{CORNER_TOKENS[question.correctIndex]}</i>}{isPrintRound(question.delivery) ? ` corner ${'ABCD'[question.correctIndex]}` : 'ABCD'[question.correctIndex]}{question.explanation ? ` — ${question.explanation}` : ''}</> : 'Choose A, B, C, or D. Everyone stays in the game.'}</p>{state.revealed ? <button className="primary" onClick={next}>{state.rounds !== 'all' && state.currentRound === state.questionIds.length - 1 ? 'Finish Game' : 'Next Question'}</button> : <button className="primary" onClick={() => update({ revealed: true })}>Reveal Answer</button>}</footer>
    </main>}
    {state.screen === 'complete' && <main className="assessment-report"><h2>{state.endedEarly ? 'Game ended.' : state.rounds === 'all' ? 'Every question explored!' : `All ${state.rounds} rounds complete!`}</h2>{state.rounds === 'all' && !state.endedEarly && <p>You've used every available question in this content pool.</p>}{state.session && <AssessmentView key={state.session.id} session={displaySession!} />}<div className="assessment-report-actions"><button className="primary" disabled={!!historyError} onClick={start}>Play Again</button><button disabled={!!historyError} onClick={() => update({ screen: 'setup' })}>Change Setup</button></div></main>}
    {panel && <AssessmentDialog onClose={() => setPanel(null)}>{panel === 'history' ? <SessionHistory presentSession={presentCornerSession} /> : state.session && <AssessmentView session={displaySession!} live />}</AssessmentDialog>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="fc-confirm"><h2 id="fc-confirm">{confirm === 'end' ? 'End this game?' : confirm === 'reset' ? 'Reset this game?' : 'Change grade?'}</h2><p>{confirm === 'end' ? 'Open the Session Report using completed rounds only. The current question and its pending points will not count.' : confirm === 'reset' ? 'Save completed rounds to History and start a new shuffled game with these settings. Pending points will be cleared.' : 'Save completed rounds to History and return to setup. Pending points will be cleared.'}</p><div className="dialog-actions"><button onClick={() => setConfirm(null)}>Cancel</button><button className="primary" onClick={confirmAction}>{confirm === 'end' ? 'End Game' : confirm === 'reset' ? 'Reset Game' : 'Change Grade'}</button></div></dialog>
  </div>;
}
