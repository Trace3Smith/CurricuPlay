import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TeamName from '../../assessment/TeamName';
import AssessmentDialog from '../../assessment/AssessmentDialog';
import SessionHistory from '../../assessment/SessionHistory';
import { saveCompletedSession } from '../../assessment/storage';
import { grades, type Grade } from '../../types';
import { planningAhead, PLANNING_AHEAD } from '../../curriculum/pacing';
import { back, begin, counts, loadState, MAX_TEAMS, MIN_TEAMS, NAME_LIMIT, next, pool, readAloudGrades, reveal, saveState, scores, selectQuestions, teamDefaultName, quickTeamColors, toggleTeam, toSession, toSetup, winners, type QuickState } from './engine';
import '../../assessment/assessment.css';
import '../board-mode.css';
import './quick-check-board.css';

const gradeLabel = (g: Grade) => g === 'K' ? 'Kindergarten' : `Grade ${g}`;
const subjectLabel = (subject: string) => subject === 'Literacy' ? 'Reading / ELA' : subject;
const teamOptions = [0, ...Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => i + MIN_TEAMS)];
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// Presentation only: the question starts large and shrinks just enough to fit (same approach as Four Corners).
const MIN_TEXT_SCALE = .5;
function fitScale(host: HTMLElement, variable: string, boxes: HTMLElement[]) {
  let scale = 1;
  host.style.setProperty(variable, '1');
  const overflowing = () => boxes.some(box => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1);
  while (scale > MIN_TEXT_SCALE && overflowing()) { scale = Math.round((scale - .05) * 100) / 100; host.style.setProperty(variable, String(scale)); }
}

export default function QuickCheck({ onHome, onClassroom }: { onHome: () => void; onClassroom: () => void }) {
  const [state, setState] = useState(loadState);
  const [saved, setSaved] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const game = useRef<HTMLElement>(null);
  const question = state.screen === 'play' ? state.questions[state.index] : undefined;
  const available = state.grade ? pool(state.grade, state.asOf) : [];
  const teamMode = state.teamCount > 0;
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { title.current?.focus(); }, [state.screen, state.index]);
  // Saving is idempotent by session id, so a refresh on the end screen never adds a second copy.
  useEffect(() => { const session = toSession(state); if (session) setHistoryError(saveCompletedSession(session)); }, [state]);
  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { if (canSpeak()) window.speechSynthesis.cancel(); }, [state.index, state.screen]);
  useLayoutEffect(() => {
    const main = game.current, prompt = main?.querySelector<HTMLElement>('.qc-prompt');
    if (!main || !prompt) return;
    const choices = [...main.querySelectorAll<HTMLElement>('.qc-choice')];
    const fit = () => { fitScale(main, '--qc-question-scale', [prompt]); if (choices.length) fitScale(main, '--qc-choice-scale', choices); };
    fit();
    void document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(prompt);
    return () => observer.disconnect();
  }, [question?.id, state.revealed, state.screen]);

  const change = (f: (s: QuickState) => QuickState) => setState(f);
  function start() {
    if (!state.grade) return;
    const picked = selectQuestions(available, state.count, state.seen[state.grade] ?? [], state.asOf);
    if (!picked.questions.length) return;
    setHistoryError('');
    setState(s => begin(s, picked.questions, picked.seen, crypto.randomUUID(), new Date().toISOString()));
  }
  function speak() {
    if (!question || !canSpeak()) return;
    window.speechSynthesis.cancel();
    const choices = question.choices ? ' ' + question.choices.map((c, i) => `${i + 1}. ${c}.`).join(' ') : '';
    const utterance = new SpeechSynthesisUtterance(question.question + choices); utterance.lang = 'en-US'; utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  const teamScores = scores(state);
  const marked = question ? state.marks[question.id] ?? [] : [];

  return <div className={`app qc-app board-mode ${state.screen === 'play' ? 'qc-playing' : ''}`}>
    <header><button className="wordmark" onClick={onHome} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button>
      <div className="header-actions"><button onClick={onClassroom}>My Classroom</button>{state.screen !== 'play' && <button onClick={() => setHistory(true)}>Session History</button>}{state.screen === 'play' && <button onClick={() => change(toSetup)}>New Quick Check</button>}<button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <p role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</p>}
    {historyError && <p role="alert" className="warning">{historyError} <button onClick={() => { const session = toSession(state); if (session) setHistoryError(saveCompletedSession(session)); }}>Retry Save</button></p>}
    {notice && <p role="status" className="warning">{notice}</p>}

    {state.screen === 'setup' && <main className="qc-setup">
      <div className="eyebrow">QUICK CHECK</div><h1 ref={title} tabIndex={-1}>A quick review to end class.</h1>
      <fieldset><legend>Grade</legend><div className="qc-options qc-grades">{grades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => change(s => ({ ...s, grade: g }))}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>Questions</legend><div className="qc-options">{counts.map(c => <button key={c} aria-pressed={state.count === c} onClick={() => change(s => ({ ...s, count: c }))}>{c}</button>)}</div></fieldset>
      <fieldset><legend>Teams</legend><div className="qc-options qc-team-counts">{teamOptions.map(n => <button key={n} aria-pressed={state.teamCount === n} aria-label={n ? `${n} teams` : 'Teams off'} onClick={() => change(s => ({ ...s, teamCount: n }))}>{n || 'Off'}</button>)}</div></fieldset>
      {teamMode && <fieldset className="qc-names"><legend>Team names</legend><div className="qc-name-inputs">{Array.from({ length: state.teamCount }, (_, i) => <label key={i}><i className="assessment-team-accent" style={{ backgroundColor: quickTeamColors[i].accent }} aria-hidden="true" /><input aria-label={`Name for team ${i + 1}`} placeholder={teamDefaultName(i)} maxLength={NAME_LIMIT} value={state.names[i]} onChange={e => change(s => ({ ...s, names: s.names.map((n, j) => j === i ? e.target.value : n) }))} /></label>)}</div></fieldset>}
      <div className="qc-start"><label>Teaching date <input aria-label="Teaching date" type="date" value={state.asOf} onChange={e => { if (e.target.value) change(s => ({ ...s, asOf: e.target.value })); }} /></label>
        <p role="status">{!state.grade ? 'Choose a grade to start.' : available.length ? `${Math.min(state.count, available.length)} questions · this week’s content plus review` : `No questions taught yet for ${gradeLabel(state.grade)} on this date.`}{state.grade && available.length > 0 && available.length < state.count && ` (only ${available.length} available)`}</p>
        <button className="primary" disabled={!available.length} onClick={start}>Start →</button></div>
      {planningAhead(state.asOf) && <p className="content-notice" role="status" data-testid="planning-ahead">{PLANNING_AHEAD}</p>}
    </main>}

    {state.screen === 'play' && question && <main className={`qc-game ${teamMode ? 'qc-with-teams' : ''}`} ref={game}>
      <div className="qc-meta"><span data-testid="qc-progress">{state.index + 1} of {state.questions.length}</span><span>{gradeLabel(state.grade!)} · {subjectLabel(question.subject)}</span>{readAloudGrades.includes(state.grade!) && canSpeak() && <button onClick={speak}>Read it to me</button>}</div>
      <div className="qc-prompt"><h1 ref={title} tabIndex={-1}>{question.question}</h1>{question.visual && <img src={question.visual.src} alt={question.visual.alt} />}</div>
      {question.choices && <ol className="qc-choices" aria-label="Choices">{question.choices.map((choice, i) => <li key={i} className={`qc-choice ${state.revealed && i === question.correctIndex ? 'qc-correct' : ''}`}><b>{i + 1}</b><span>{choice}</span>{state.revealed && i === question.correctIndex && <strong className="qc-check">✓ Correct</strong>}</li>)}</ol>}
      {state.revealed && !question.choices && <div className="qc-answer" role="status"><span>Answer</span><p>{question.answer}</p></div>}
      {state.revealed && question.choices && <p className="qc-answer-line" role="status">Answer: {question.correctIndex! + 1} · {question.answer}</p>}
      {teamMode && state.revealed && <section className="qc-mark" aria-label="Mark teams that got it right"><span>Tap each team that got it right</span><div>{state.teams!.map(t => <button key={t.id} aria-pressed={marked.includes(t.id)} onClick={() => change(s => toggleTeam(s, t.id))}><TeamName team={t} />{marked.includes(t.id) ? ' ✓' : ''}</button>)}</div></section>}
      <footer className="qc-controls"><button disabled={state.index === 0 && !state.revealed} onClick={() => change(back)}>← Back</button>{state.revealed
        ? <button className="primary" onClick={() => change(s => next(s, new Date().toISOString()))}>{state.index === state.questions.length - 1 ? 'Finish' : 'Next →'}</button>
        : <button className="primary" onClick={() => change(reveal)}>Reveal</button>}</footer>
      {teamMode && <div className="qc-scorebar" aria-label="Scores">{teamScores.map(t => <span key={t.id} data-testid={`qc-score-${t.id}`}><TeamName team={t} /> <b>{t.score}</b></span>)}</div>}
    </main>}

    {state.screen === 'complete' && <main className="qc-end">
      <h1 ref={title} tabIndex={-1}>Nice work!</h1>
      {teamMode && <section className="qc-final" aria-label="Final scores"><p className="qc-winner" data-testid="qc-winner">{(() => { const w = winners(state); return w.length === teamScores.length && teamScores.length > 1 ? 'It’s a tie between every team!' : w.length > 1 ? `Tie: ${w.map(t => t.name).join(' and ')}` : `Winner: ${w[0].name}`; })()}</p>
        <div className="qc-final-scores">{teamScores.map(t => <span key={t.id}><TeamName team={t} /> <b>{t.score}</b></span>)}</div></section>}
      <ol className="qc-summary">{state.questions.map((q, i) => <li key={q.id}><span className="qc-summary-meta">{i + 1} · {subjectLabel(q.subject)}{q.standard ? ` · ${q.standard}` : ''}</span><p>{q.question}</p><p className="qc-summary-answer">{q.choices ? `${q.correctIndex! + 1} · ` : ''}{q.answer}</p></li>)}</ol>
      <div className="qc-end-actions"><button className="primary" disabled={!!historyError} onClick={() => { const s = toSetup(state); setState(s); }}>New Quick Check</button><button onClick={onHome}>Games</button></div>
    </main>}
    {history && <AssessmentDialog onClose={() => setHistory(false)}><SessionHistory /></AssessmentDialog>}
  </div>;
}
