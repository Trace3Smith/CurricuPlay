import { useEffect, useMemo, useRef, useState } from 'react';
import { grades, type GameState, type Grade } from './types';
import { bank, createQuestionEngine } from './services/questionEngine';
import { localDate } from './services/curriculumService';
import { loadState, saveState } from './utils/storage';
import { categories, tiles } from './games/jeopardy/board';
const gradeLabel = (g: Grade) => g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`;
export default function App() {
  const [state, setState] = useState(loadState);
  const [saved, setSaved] = useState(true);
  const [confirm, setConfirm] = useState<'reset' | 'grade' | null>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { title.current?.focus(); }, [state.screen]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  const engine = useMemo(() => createQuestionEngine(bank.questions, state.usedQuestionIds), [state.usedQuestionIds]);
  const filters = { grade: state.grade, range: state.range, asOf: state.asOf };
  const available = engine.getAvailableQuestionCount(filters);
  const current = bank.questions.find(q => q.id === state.current?.questionId);
  function update(patch: Partial<GameState>) { setState(s => ({ ...s, ...patch })); }
  function fresh(screen: GameState['screen']) { update({ screen, selectedGame: screen === 'setup' ? null : 'jeopardy', current: null, usedTiles: [], usedQuestionIds: [] }); }
  function choose(tile: typeof tiles[number]) {
    if (state.usedTiles.includes(tile.id)) return;
    const q = engine.getRandomQuestion({ ...filters, subject: tile.category, difficulty: tile.difficulty });
    if (!q) return;
    engine.markQuestionUsed(q.id);
    setState(s => ({ ...s, screen: 'question', usedTiles: [...s.usedTiles, tile.id], usedQuestionIds: [...s.usedQuestionIds, q.id], current: { questionId: q.id, tileId: tile.id, category: tile.category, revealed: false } }));
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setFullscreenError('Use your browser’s full-screen control (usually F11).'); }
  }
  const active = state.screen === 'board' || state.screen === 'question';
  return <div className={`app ${active ? 'playing' : ''}`}>
    <header><button className="wordmark" onClick={() => update({ screen: 'home' })} aria-label="CurricuPlay home">CURRICU<span>PLAY</span><i /></button>
      <div className="header-actions">{active && <><span className="grade-pill">{gradeLabel(state.grade)}</span><button onClick={() => setConfirm('grade')}>Change Grade</button><button onClick={() => setConfirm('reset')}>Reset Game</button></>}
        {state.screen !== 'home' && <button onClick={() => update({ screen: 'home' })}>Home</button>}<button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <div role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</div>}
    {fullscreenError && <div role="status" className="warning">{fullscreenError}</div>}
    {state.screen === 'home' && <main className="home">
      <div className="eyebrow">BIG IDEAS. SHARED DISCOVERIES.</div>
      <h1 ref={title} tabIndex={-1}>This week’s content.<br /><span>Ready to play.</span></h1>
      <p className="intro">Your curriculum. Your classroom. A new way to play.</p>
      <div className="game-cards">
        <button className="game-card live" onClick={() => update({ screen: state.selectedGame === 'jeopardy' ? (state.current ? 'question' : 'board') : 'setup' })}>
          <span className="card-art" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span className="card-bottom"><strong>JEOPARDY</strong><span className="play-tag">{state.selectedGame ? 'CONTINUE' : 'PLAY'} ↗</span></span>
          <span className="card-description">Pick a category. Take on a challenge.</span>
        </button>
        {['FOUR CORNERS', 'BINGO', 'TRIVIA'].map((name, i) => <div className="game-card soon" key={name}><span className="future-art" aria-hidden="true">{['↗', '◎', '?'][i]}</span><strong>{name}</strong><span className="coming">COMING SOON</span></div>)}
      </div>
      <div className="home-note">Made for shared screens & curious minds.<span>Grades K–5 · Teacher-led play</span></div>
      {!bank.questions.length && <p className="content-notice" role="status">{bank.errors.length ? `Question bank needs correction: ${bank.errors.join(' ')}` : 'Awaiting the verified question bank and DCSS FY27 pacing guide. You can explore setup; play unlocks when questions are added.'}</p>}
    </main>}
    {state.screen === 'setup' && <main className="setup">
      <div className="eyebrow">JEOPARDY / QUICK SETUP</div><h1 ref={title} tabIndex={-1}>Let’s get your class playing.</h1>
      <fieldset><legend>1 <span>Select grade</span></legend><div className="grade-options">{grades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => update({ grade: g })}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>2 <span>Choose your content</span></legend><div className="range-options"><button aria-pressed={state.range === 'recent'} onClick={() => update({ range: 'recent' })}><strong>RECENT CONTENT</strong><span>This instructional week + the previous week</span></button><button aria-pressed={state.range === 'all'} onClick={() => update({ range: 'all' })}><strong>EVERYTHING TAUGHT SO FAR</strong><span>All available content through the selected date</span></button></div></fieldset>
      <div className="setup-bottom"><label>Content through <input aria-label="Content through" type="date" max={localDate()} value={state.asOf} onChange={e => { if (e.target.value && e.target.value <= localDate()) update({ asOf: e.target.value }); }} /></label><p>Future content is always excluded.<br /><strong>{available} verified questions available</strong></p><button className="primary" disabled={!available} onClick={() => { update({ selectedGame: 'jeopardy' }); fresh('board'); }}>Start Game →</button></div>
      {!available && <div className="content-notice" role="status">No questions available for this selection. {bank.questions.length ? 'Try another grade, date, or Everything Taught So Far.' : 'Add the verified local question bank to enable play.'}</div>}
      <p className="hint">Students answer aloud, on paper, or with classroom response tools. You lead the game.</p>
    </main>}
    {state.screen === 'board' && <main className="board-screen">
      <div className="board-heading"><div><div className="eyebrow">JEOPARDY</div><h1 ref={title} tabIndex={-1}>Choose your challenge.</h1></div><p>{state.range === 'recent' ? 'Recent content' : 'Everything taught so far'} · Through {state.asOf}<br /><strong>{state.usedTiles.length} / 30 tiles played</strong></p></div>
      <div className="board">{categories.map(category => <section className="board-column" key={category} aria-label={category}><h2>{category.toUpperCase()}</h2>{tiles.filter(t => t.category === category).map(tile => {
        const used = state.usedTiles.includes(tile.id), count = engine.getAvailableQuestionCount({ ...filters, subject: category, difficulty: tile.difficulty });
        return <button className={`tile ${used ? 'used' : ''}`} key={tile.id} disabled={used || !count} aria-label={`${category} ${tile.difficulty} ${tile.difficulty === 1 ? 'point' : 'points'} opportunity ${Number(tile.id.slice(-1)) + 1}${used ? ' used' : !count ? ' no questions available' : ''}`} onClick={() => choose(tile)}>{used ? <span>✓ USED</span> : !count ? <span>NO QUESTIONS<br />AVAILABLE</span> : <><strong>{tile.difficulty}</strong><span>{tile.difficulty === 1 ? 'POINT' : 'POINTS'}</span></>}</button>;
      })}</section>)}</div>
      <footer>{state.usedTiles.length === 30 || !tiles.some(t => !state.usedTiles.includes(t.id) && engine.getAvailableQuestionCount({ ...filters, subject: t.category, difficulty: t.difficulty })) ? 'All available challenges completed. Reset for a new class or change your selection.' : 'Choose a tile · Answer together · Reveal & discuss'}<span>Review uses marked review questions or earlier content.</span></footer>
    </main>}
    {state.screen === 'question' && current && <main className="question-screen">
      <div className="question-meta"><span>{state.current?.category.toUpperCase()}{state.current?.category === 'Review' ? ` · ${current.subject.toUpperCase()}` : ''}</span><span className="points">{current.difficulty} {current.difficulty === 1 ? 'POINT' : 'POINTS'}</span></div>
      <div className="read-note">{state.grade === 'K' ? 'TEACHER READS QUESTION ALOUD' : state.grade === '1' ? 'TEACHER MAY READ QUESTION ALOUD' : current.teacherRead ? 'TEACHER READS QUESTION ALOUD' : 'THINK IT THROUGH. SHARE YOUR ANSWER.'}</div>
      <div className={`question-content ${current.question.length > 180 ? 'long' : ''}`}><h1 ref={title} tabIndex={-1}>{current.question}</h1>{!state.current?.revealed && current.choices && <div className="choices">{current.choices.map((c, i) => <div key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>)}</div>}
        {state.current?.revealed && <div className="answer" role="status"><span>CORRECT ANSWER</span><p>{current.answer}</p></div>}</div>
      <div className="question-bottom">{state.current?.revealed ? <button className="primary" onClick={() => update({ screen: 'board', current: null })}>Back to Board →</button> : <button className="primary" onClick={() => update({ current: { ...state.current!, revealed: true } })}>Reveal Answer</button>}<span>{current.standard} · {current.source}</span></div>
    </main>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="confirm-title"><h2 id="confirm-title">{confirm === 'reset' ? 'Reset this game?' : 'Change grade or content?'}</h2><p>{confirm === 'reset' ? 'Clear played tiles and used questions for a fresh class. Your grade, range, and content date stay the same.' : 'This ends the current game and clears its progress. Choose a new grade or content range in setup.'}</p><div className="dialog-actions"><button autoFocus onClick={() => setConfirm(null)}>Keep Playing</button><button className="primary" onClick={() => { fresh(confirm === 'reset' ? 'board' : 'setup'); setConfirm(null); }}>{confirm === 'reset' ? 'Reset Game' : 'Change Grade'}</button></div></dialog>
  </div>;
}
