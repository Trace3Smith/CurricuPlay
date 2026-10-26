import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatAccuracy, summarizeSession } from '../../assessment/engine';
import { beginGame, canScore, controlTimer, currentWord, remaining, exhausted, repeatCycle, extendGame, letterChoices, committed, commitResults, finishGame, nextWord, reveal, revealAnotherLetter, toggleTeam, type BeeState } from './engine';
import { ACTIVE_KEY, readActive, readHistory, saveActive, saveHistory } from './storage';
import { answerFor, difficulties, displayedSlots, displayedWord, nextHintIndex, pictures, type Difficulty } from './words';
import WordBank from './WordBank';
import RoundTimer from './RoundTimer';
import { freshTimer } from './timer';
import './spelling-bee.css';

export default function SpellingBee({ onHome, onClassroom }: { onHome: () => void; onClassroom: () => void }) {
  const [loaded] = useState(readActive);
  const [state, setState] = useState(loaded.state);
  const [saveError, setSaveError] = useState(loaded.error);
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(readHistory);
  const [report, setReport] = useState<BeeState | null>(null);
  const [page, setPage] = useState(0);
  const [ending, setEnding] = useState(false);
  const [adding, setAdding] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const now = () => new Date().toISOString();
  function persist(s: BeeState) {
    const activeError = saveActive(s);
    const historyError = s.screen === 'complete' ? saveHistory(s) : '';
    setSaveError([activeError, historyError].filter(Boolean).join(' '));
  }
  // Save before the new screen is painted: immediate refresh/navigation must not
  // restore the prior round after the teacher has already seen its summary.
  useLayoutEffect(() => { if (state) persist(state); }, [state]);
  useEffect(() => { heading.current?.focus(); }, [state?.index, state?.screen, state?.flow?.cycle, state?.session.questions.length, showHistory, report]);
  useEffect(() => { if (ending) dialog.current?.showModal(); else dialog.current?.close(); }, [ending]);
  useEffect(() => {
    function sync(e: StorageEvent) {
      if (e.key !== ACTIVE_KEY && e.key !== null) return;
      const latest = readActive();
      if (latest.error) setSaveError(latest.error);
      else { setState(latest.state); setNotice('Session updated from another tab. Use one teacher tab for scoring.'); }
    }
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('storage', sync); window.speechSynthesis?.cancel(); };
  }, []);
  function change(action: (s: BeeState) => BeeState) { setState(s => s ? action(s) : s); }
  function speak(text: string) {
    if (!('speechSynthesis' in window)) { setNotice('Spoken clues are unavailable here. Please read the clue aloud.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 0.8;
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) setNotice('Audio could not play. Please read aloud.'); };
    window.speechSynthesis.speak(utterance);
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  const shown = report ?? state;
  const summary = useMemo(() => shown ? summarizeSession(shown.session) : null, [shown?.session]);
  const word = state ? currentWord(state) : undefined;
  const answer = word ? answerFor(word) : '';
  const initial = word?.activity === 'initial';
  const locked = state ? committed(state) : false;
  const scoringOpen = state ? canScore(state) : false;
  const picture = word?.picture ? pictures[word.picture] : null;
  return <div className="app bee-app">
    <header><button className="wordmark" onClick={onHome} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button><div className="header-actions"><button onClick={onClassroom}>My Classroom</button><button onClick={onHome}>Games</button><button onClick={() => void fullscreen()}>Full Screen</button></div></header>
    {saveError && <div className="warning" role="alert">{saveError} {state && <button onClick={() => persist(state)}>Retry Saving</button>}</div>}
    {notice && <p className="bee-notice" role="status">{notice}</p>}
    {!state && !showHistory && !report && <><WordBank onStart={(words, grade, difficulty, options) => { setState(beginGame(words, grade, difficulty, crypto.randomUUID(), now(), Math.random, options)); setNotice(''); }} /><button className="bee-history-button" onClick={() => { setHistory(readHistory()); setShowHistory(true); }}>Spelling Bee History</button></>}
    {showHistory && !report && <main className="bee-panel bee-history"><h1 ref={heading} tabIndex={-1}>Spelling Bee History</h1><p>Saved on this browser only. Team results do not measure individual student mastery.</p>{history.error && <p role="alert">{history.error}</p>}{!history.states.length && <p>No completed sessions yet.</p>}{history.states.slice(page * 5, page * 5 + 5).map(s => <button key={s.session.id} onClick={() => { setReport(s); setPage(0); }}>Grade {s.grade} · {new Date(s.session.startedAt).toLocaleString()} · {s.session.questions.length} words</button>)}<div className="bee-actions"><button disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={(page + 1) * 5 >= history.states.length} onClick={() => setPage(p => p + 1)}>Next Page</button><button onClick={() => setShowHistory(false)}>Back to Setup</button></div></main>}
    {shown && summary && (report || state?.screen === 'complete') && <main className="bee-summary">
      <p className="eyebrow">SPELLING BEE / GRADE {shown.grade}</p><h1 ref={heading} tabIndex={-1}>Session Summary</h1>
      <p>{summary.completedQuestions} prompts committed · {summary.overall.attempts} team responses · Accuracy: <strong data-testid="bee-accuracy">{formatAccuracy(summary.overall)}</strong></p>
      <p>Only committed results count. Group performance is not individual student mastery.</p>
      <div className="bee-scoreboard" aria-label="Final scoreboard">{summary.teams.map(t => <article key={t.id} style={{ borderColor: t.accent }}><h2 style={{ color: t.accent }}>{t.name}</h2><strong>{t.score}</strong><p>{formatAccuracy(t.overall)}</p></article>)}</div>
      <div className="bee-panel"><h2>Word results</h2>{summary.questions.length ? summary.questions.slice(page * 3, page * 3 + 3).map(q => <p key={q.questionId}>{q.prompt.includes(' — Beginning sound: ') ? q.prompt.replace(' — Beginning sound: ', ' · ') : q.prompt.split(' — ')[0].replace(/^NONFICTION$/, 'NON-FICTION')} · {q.concept} · {q.correct}/{q.attempts} teams correct</p>) : <p>No word results were committed.</p>}<div className="bee-actions"><button disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={(page + 1) * 3 >= summary.questions.length} onClick={() => setPage(p => p + 1)}>Next Page</button></div></div>
      <div className="bee-actions">{report ? <button onClick={() => { setReport(null); setPage(0); }}>Back to History</button> : <button className="primary" disabled={!!saveError} onClick={() => { try { localStorage.removeItem(ACTIVE_KEY); } catch { setSaveError('Could not clear the completed session. Retry saving, then try again.'); return; } setState(null); setPage(0); setNotice(''); }}>New Game</button>}<button onClick={onHome}>Back to Games</button></div>
    </main>}
    {state?.screen === 'play' && adding && state.flow && <WordBank fixed={{ grade: state.grade, cutoff: state.flow.selection.cutoff }} onCancel={() => setAdding(false)} onStart={(words, _grade, _difficulty, options) => { const updated = extendGame(state, words, options, now()); if (updated === state) { setNotice('No unused prompts to add in this selection. Choose another eligible bank or return to finish/repeat.'); return; } setState(updated); setAdding(false); setNotice('Reviewed prompts added at the original teaching date. Scores are kept.'); }} />}
    {state && exhausted(state) && !adding && <main className="bee-summary"><h1 ref={heading} tabIndex={-1}>All prompts in this cycle are committed</h1><p>0 unused prompts remain · Cycle {state.flow!.cycle} · {state.session.questions.length} prompts committed</p><p>Choose what happens next. A repeat/review cycle reuses this bank; your scores continue. Adding content keeps the same teaching date ({state.flow!.selection.cutoff}).</p><div className="bee-panel"><h2>Last prompt</h2>{state.revealed ? <p data-testid="bee-last-answer">{initial ? `${answer.toUpperCase()} — ${word?.word}` : displayedWord(word!).toUpperCase()}</p> : <button onClick={() => change(reveal)}>Teacher: Reveal Answer</button>}</div><div className="bee-scoreboard">{summary!.teams.map(t => <article key={t.id} style={{ borderColor: t.accent }}><h2 style={{ color: t.accent }}>{t.name}</h2><strong>{t.score}</strong></article>)}</div><div className="bee-actions"><button className="primary" onClick={() => change(s => finishGame(s, now()))}>Finish Game</button><button onClick={() => setAdding(true)}>Choose More Eligible Content</button><button onClick={() => change(s => repeatCycle(s))}>Start Repeat / Review Cycle</button></div></main>}
    {state?.screen === 'play' && word && !adding && !exhausted(state) && <main className={`bee-play ${state.grade === 'K' ? 'bee-kindergarten' : ''}`}>
      <div className="bee-round"><h1 ref={heading} tabIndex={-1}>Spelling Bee · {initial ? 'Picture' : 'Word'} {state.index + 1} of {state.flow?.order.length ?? state.words.length}</h1><span>Grade {state.grade} · {word.grade !== state.grade ? 'Prior-Grade Review' : word.kind === 'sample' ? 'General practice' : word.kind === 'curriculum' ? word.curriculum?.category === 'source-listed' ? 'Source-listed term' : 'Skill practice' : 'Teacher list'}{state.flow && ` · ${remaining(state)} unused · Cycle ${state.flow.cycle}${state.flow.cycle > 1 ? ' (repeat/review)' : ''}`}</span><button onClick={() => setEnding(true)}>End Game</button></div>
      {state.grade !== 'K' && <RoundTimer timer={state.timer ?? freshTimer()} locked={locked} onAction={(action, duration) => change(s => controlTimer(s, action, Date.now(), duration))} />}
      <div className="bee-challenge">{picture && <img key={word.id} src={picture.src} alt={initial ? 'Object picture. Choose Say Word to hear its name.' : picture.alt} onError={e => { e.currentTarget.hidden = true; setNotice('Picture unavailable. Please use the spoken or written clue.'); }} />}<div><p className="bee-clue">{word.clue}</p><p className="bee-muted">{initial ? 'Teacher: say the object name. Find only its beginning letter.' : ['K', '1', '2'].includes(state.grade) ? 'Teacher: read aloud. Say the sounds, then blend and build the word.' : 'Teacher: read the clue aloud. Discuss its meaning, then build the word.'}</p></div></div>
      <div className={`bee-slots ${answer.length > 10 ? 'bee-long' : ''}`} role="group" aria-label={state.revealed ? `Answer: ${(initial ? answer : displayedWord(word)).toUpperCase()}` : initial ? 'Beginning letter slot' : 'Spelling letter slots'}>{displayedSlots(word, state.difficulty, state.extraLetters, state.revealed).map((c, i) => <span key={i} className={c === '-' ? 'bee-punctuation' : undefined} aria-label={c === '-' ? 'Hyphen: no letter to collect' : `Letter slot: ${c === '_' ? 'blank' : c}`} >{c}</span>)}</div>
      <div className="bee-tools">{initial ? <label>Letter choices<select aria-label="Letter choices" value={state.flow?.choices ?? 0} onChange={e => change(s => s.flow ? { ...s, flow: { ...s.flow, choices: Number(e.target.value) as 0 | 2 | 3 } } : s)}><option value={0}>No choices</option><option value={2}>Two choices</option><option value={3}>Three choices</option></select></label> : <><label>Letter hints<select aria-label="Letter hints" value={state.difficulty} onChange={e => change(s => ({ ...s, difficulty: e.target.value as Difficulty }))}>{difficulties.map(d => <option key={d} value={d}>{d === 'supported' ? 'One missing letter' : d === 'missing' ? 'Adaptive anchor letters' : 'No letters'}</option>)}</select></label><button disabled={state.revealed || nextHintIndex(answer, state.difficulty, state.extraLetters) === undefined} onClick={() => change(revealAnotherLetter)} aria-describedby="bee-hint-help">Reveal Another Letter</button></>}<button onClick={() => speak(initial ? `What letter does ${word.word} start with?` : word.clue)}>Speak Clue</button><button onClick={() => speak(word.word)}>Say Word</button><button disabled={state.revealed} onClick={() => change(reveal)}>{state.revealed ? 'Answer Revealed' : 'Teacher: Reveal Answer'}</button></div>
      <div id="bee-hint-help" className="bee-hint-help">{initial ? <>{state.revealed ? <p>{word.word.toUpperCase()} starts with {answer.toUpperCase()}.</p> : <div className="bee-letter-choices" role="group" aria-label="Possible letters">{letterChoices(word, state.flow?.choices ?? 0).map(c => <span key={c}>{c}</span>)}</div>}<p>The beginning letter stays hidden until Teacher: Reveal Answer.</p></> : <p>Added letters stay visible when changing hint levels. One letter stays hidden until Reveal Answer.</p>}</div>
      <section className="bee-scoring" aria-label="Teacher scoring"><p id="bee-scoring-help">{locked ? 'Results committed. Scores are locked for this word.' : !scoringOpen ? 'All teams get the same time. Wait for time to expire or choose Teacher: End Round Early.' : 'Teacher: select every team that finished correctly. Commit records unselected teams as incorrect.'}</p><div className="bee-scoreboard">{summary!.teams.map(t => <button key={t.id} disabled={locked || !scoringOpen} aria-pressed={state.correctTeamIds.includes(t.id)} aria-label={`${t.name}: ${t.score} points${state.correctTeamIds.includes(t.id) ? ', marked correct' : ''}`} aria-describedby="bee-scoring-help" style={{ borderColor: t.accent }} onClick={() => change(s => toggleTeam(s, t.id))}><span style={{ color: t.accent }}>{t.name}</span><strong>{t.score}</strong><small>{state.correctTeamIds.includes(t.id) ? (locked ? '✓ Correct' : '✓ Pending +1') : (locked ? 'Not correct' : 'Mark correct')}</small></button>)}</div></section>
      <div className="bee-actions"><span role="status">{locked ? 'Committed results · 6 team responses' : 'No results committed for this word'}</span><button disabled={locked || !state.correctTeamIds.length} onClick={() => change(s => ({ ...s, correctTeamIds: [] }))}>Clear Selection</button><button className="primary" disabled={locked || !scoringOpen} onClick={() => change(s => commitResults(s, now()))}>Commit Results</button><button className="primary" disabled={!locked} onClick={() => { window.speechSynthesis?.cancel(); change(s => nextWord(s, now())); }}>{!state.flow?.untilStop && state.index === (state.flow?.order.length ?? state.words.length) - 1 ? 'Finish Game' : 'Next Word'}</button></div>
    </main>}
    <dialog ref={dialog} aria-labelledby="bee-end-title" onCancel={() => setEnding(false)}><h2 id="bee-end-title">End this game?</h2><p>Committed points are kept. Any uncommitted selections for the current word will not count.</p><div className="bee-actions"><button autoFocus onClick={() => setEnding(false)}>Keep Playing</button><button className="primary" onClick={() => { change(s => finishGame(s, now())); setEnding(false); window.speechSynthesis?.cancel(); }}>End Game</button></div></dialog>
  </div>;
}
