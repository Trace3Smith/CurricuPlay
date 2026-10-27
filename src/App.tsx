import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionReview from './components/QuestionReview';
import FourCorners from './games/four-corners/FourCorners';
import { readActive as readSpellingBee } from './games/spelling-bee/storage';
import { readActive as readBingo } from './games/state-lingo-bingo/storage';
import { isTeamMode, loadState as loadFourCornersState } from './games/four-corners/engine';
import { readReviews, REVIEW_KEY } from './services/questionReview';
import { grades, type Filters, type GameState, type Grade } from './types';
import { classroomQuestions, classroomBank, PACK_NAME } from './services/classroomPack';
import { bank, createQuestionEngine, isPaced, questionStatus } from './services/questionEngine';
import { currentWindow, planningAhead, PLANNING_AHEAD, shortDate } from './curriculum/pacing';
import { loadState, saveState } from './utils/storage';
import { categories, tiles, isBoardEligible } from './games/jeopardy/board';
import { readLastOpened, spotlightGame, type HubGame } from './games/lastOpened';
import './games/board-mode.css';
import './games-hub.css';
import './games/jeopardy/jeopardy.css';
// Current + Review boards fill each subject from Current first, then Review. Saved legacy boards keep their range.
const boardSlots = (base: Pick<Filters, 'grade' | 'range' | 'asOf' | 'unused'>) => tiles.map(t => ({ id: t.id,
  ...(isPaced(base.range) && t.category !== 'Review'
    ? { filters: { ...base, range: 'current' as const, subject: t.category, difficulty: t.difficulty }, fallback: { ...base, range: 'review' as const, subject: t.category, difficulty: t.difficulty } }
    : { filters: { ...base, subject: t.category, difficulty: t.difficulty } }) }));
const gradeLabel = (g: Grade) => g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`;
export default function App({ gamePath, reviewDirect, onNavigate, onExit, onBackup, preservationNotice }: { gamePath: string; reviewDirect: boolean; onNavigate: (path: string, reviewAll?: boolean) => void; onExit: () => void; onBackup: () => void; preservationNotice: string }) {
  const [state, setState] = useState(loadState);
  // Route presentation does not rewrite a saved game's progress or allocation.
  const screen = gamePath === '/games' || gamePath === '/games/' ? 'home'
    : state.screen === 'home' ? (state.selectedGame === 'jeopardy' ? (state.current ? 'question' : 'board') : 'setup') : state.screen;
  const fourCorners = gamePath === '/games/four-corners';
  const reviewing = gamePath === '/games/review';
  const [reviews, setReviews] = useState(readReviews);
  const questions = useMemo(() => classroomQuestions(reviews.decisions, state.contentSource), [reviews.decisions, state.contentSource]);
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === REVIEW_KEY || e.key === null) setReviews(readReviews()); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  const [saved, setSaved] = useState(true);
  const [confirm, setConfirm] = useState<'reset' | 'grade' | null>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { title.current?.focus(); }, [screen]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  const engine = useMemo(() => createQuestionEngine(questions, state.usedQuestionIds), [questions, state.usedQuestionIds]);
  const filters = { grade: state.grade, range: state.range, asOf: state.asOf };
  const available = engine.getAvailableQuestionCount(filters);
  const plan = engine.planQuestions(boardSlots({ ...filters, unused: false }));
  const currentCount = isPaced(state.range) ? engine.getAvailableQuestionCount({ ...filters, range: 'current', unused: false }) : 0;
  const pacingWindow = currentWindow(state.asOf);
  const reviewTag = (questionId?: string, category?: string) => {
    const q = questionId && category !== 'Review' && isPaced(state.range) ? questions.find(q => q.id === questionId) : undefined;
    return !!q && questionStatus(q, state.asOf) === 'review';
  };
  function startGame(grade = state.grade, range = state.range, asOf = state.asOf, contentSource = state.contentSource) {
    const planned = createQuestionEngine(classroomQuestions(reviews.decisions, contentSource)).planQuestions(boardSlots({ grade, range, asOf }), true);
    if (!planned.complete) return;
    setState(s => ({ ...s, grade, range, asOf, contentSource, screen: 'board', selectedGame: 'jeopardy', assignments: planned.assignments, current: null, usedTiles: [], usedQuestionIds: [] }));
    onNavigate('/games/jeopardy');
  }
  const blockedBoard = state.assignments !== undefined && !isBoardEligible(state.assignments, questions, filters);
  const current = questions.find(q => q.id === state.current?.questionId);
  useEffect(() => { if (state.current && !engine.getQuestions({ grade: state.grade, range: state.range, asOf: state.asOf, unused: false }).some(q => q.id === state.current?.questionId)) setState(s => ({ ...s, current: null, screen: s.screen === 'question' ? 'board' : s.screen })); }, [engine, state.current, state.grade, state.range, state.asOf]);
  function update(patch: Partial<GameState>) { setState(s => ({ ...s, ...patch })); }
  function fresh(screen: GameState['screen']) { if (screen === 'board' && state.assignments) { startGame(); return; } update({ screen, assignments: undefined, selectedGame: screen === 'setup' ? null : 'jeopardy', current: null, usedTiles: [], usedQuestionIds: [], ...(screen === 'setup' ? { range: 'mixed' as const } : {}) }); }
  function choose(tile: typeof tiles[number]) {
    if (blockedBoard || state.usedTiles.includes(tile.id)) return;
    const tileFilters = { ...filters, subject: tile.category, difficulty: tile.difficulty };
    const q = state.assignments ? engine.getQuestions(tileFilters).find(q => q.id === state.assignments?.[tile.id]) : engine.getRandomQuestion(tileFilters);
    if (!q) return;
    engine.markQuestionUsed(q.id);
    setState(s => ({ ...s, screen: 'question', usedTiles: [...s.usedTiles, tile.id], usedQuestionIds: [...s.usedQuestionIds, q.id], current: { questionId: q.id, tileId: tile.id, category: tile.category, revealed: false } }));
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setFullscreenError('Use your browser’s full-screen control (usually F11).'); }
  }
  const active = screen === 'board' || screen === 'question';
  if (fourCorners) return <FourCorners onClassroom={onExit} onHome={() => { onNavigate('/games'); update({ screen: 'home' }); }} />;
  if (reviewing) return <QuestionReview questions={bank.questions} decisions={reviews.decisions} storageError={reviews.error} initialGrade={reviewDirect ? '1' : undefined} onStartTrial={(grade, range, asOf) => startGame(grade, range, asOf, 'drafts')} onSaved={decisions => setReviews({ decisions, error: '' })} onClose={() => onNavigate('/games')} />;
  // Read through the game's recovery rules each time the landing renders; never save here.
  const cornerState = screen === 'home' ? loadFourCornersState() : null;
  const resumableBee = screen === 'home' && readSpellingBee().state?.screen === 'play';
  const resumableCorners = cornerState?.screen === 'play' ? cornerState : null;
  const bingoState = screen === 'home' ? readBingo().state : null;
  const resumableBingo = bingoState?.screen === 'play' ? bingoState : null;
  // Only one saved game gets the orange board spotlight; the others show a white-outlined CONTINUE.
  const savedGames = ([['jeopardy', !!state.selectedGame], ['four-corners', !!resumableCorners], ['spelling-bee', resumableBee], ['state-lingo-bingo', !!resumableBingo]] as const).filter(([, saved]) => saved).map(([game]) => game);
  const spotlight = screen === 'home' ? spotlightGame(savedGames, readLastOpened()) : null;
  const spot = (game: HubGame) => (spotlight === game ? '' : undefined);
  return <div className={`app board-mode ${active ? 'playing' : ''} ${screen === 'home' ? 'hub' : 'jeopardy'}`}>
    <header><button className="wordmark" onClick={() => { update({ screen: 'home' }); onNavigate('/games'); }} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button>
      <div className="header-actions"><button onClick={onExit}>My Classroom</button>{active && <><span className="grade-pill">{gradeLabel(state.grade)}</span><button onClick={() => setConfirm('grade')}>Change Grade</button><button disabled={blockedBoard && !plan.complete} onClick={() => setConfirm('reset')}>Reset Game</button></>}
        {!active && <a href="/games/review" onClick={event => { event.preventDefault(); onNavigate('/games/review'); }}>Question Review</a>}{screen !== 'home' && <button onClick={() => { update({ screen: 'home' }); onNavigate('/games'); }}>Home</button>}<button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <div role="alert" className="warning">Progress cannot be saved in this browser. Keep this tab open during class.</div>}
    {fullscreenError && <div role="status" className="warning">{fullscreenError}</div>}
    {screen === 'home' && <main className="home">
      <div className="eyebrow">BIG IDEAS. SHARED DISCOVERIES.</div>
      <h1 ref={title} tabIndex={-1}>This week’s content.<br /><span>Ready to play.</span></h1>
      <p className="intro">Your curriculum. Your classroom. A new way to play.</p>
      <div className="game-cards">
        {/* data-spotlight only styles the most recently opened saved game as the board spotlight. */}
        <button className="game-card live" data-spotlight={spot('jeopardy')} onClick={() => { update({ screen: state.selectedGame === 'jeopardy' ? (state.current ? 'question' : 'board') : 'setup' }); onNavigate('/games/jeopardy'); }}>
          <span className="card-art" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span className="card-bottom"><strong>JEOPARDY</strong><span className="play-tag">{state.selectedGame ? 'CONTINUE' : 'PLAY'} ↗</span></span>
          <span className="card-description">Pick a category. Take on a challenge.</span>
        </button>
        <button className="game-card live" data-spotlight={spot('four-corners')} onClick={() => onNavigate('/games/four-corners')}><span className="fc-home-art" aria-hidden="true">{['A', 'B', 'C', 'D'].map(letter => <b key={letter}>{letter}</b>)}</span><span className="card-bottom"><strong>FOUR CORNERS</strong><span className="play-tag" style={{ whiteSpace: 'nowrap' }}>{resumableCorners ? 'CONTINUE' : 'PLAY'} ↗</span></span><span className="card-description">{resumableCorners ? `${gradeLabel(resumableCorners.grade)} · ${isTeamMode(resumableCorners) ? 'Team Mode' : 'Classic'}` : 'Think. Move. Everyone stays in.'}</span></button>
        <button className="game-card live" data-spotlight={spot('spelling-bee')} onClick={() => onNavigate('/games/spelling-bee')}><span className="bee-home-art" aria-hidden="true">A B C</span><span className="card-bottom"><strong>SPELLING BEE</strong><span className="play-tag">{resumableBee ? 'CONTINUE' : 'PLAY'} ↗</span></span><span className="card-description">Collect letters. Build words. Play together.</span></button>
        <button className="game-card live" data-spotlight={spot('state-lingo-bingo')} onClick={() => onNavigate('/games/state-lingo-bingo')}><span className="slb-home-art" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span className="card-bottom"><strong>STATE LINGO BINGO</strong><span className="play-tag" style={{ whiteSpace: 'nowrap' }}>{resumableBingo ? 'CONTINUE' : 'PLAY'} ↗</span></span><span className="card-description">{resumableBingo ? `${gradeLabel(resumableBingo.settings.grade)} · ${resumableBingo.teams!.length} teams` : 'Roll. Move. Dig for the capital.'}</span></button>
      </div>
      <button className="review-entry" onClick={() => onNavigate('/games/review', true)}>Teacher tools · Question Review</button>
      <button className="review-entry" onClick={onBackup}>Export browser Games data</button>{preservationNotice && <p role="status" className="content-notice">{preservationNotice}</p>}
      <div className="home-note">Made for shared screens & curious minds.<span>Grades K–5 · Teacher-led play</span></div>
      {(!bank.questions.length || questions.every(q => q.reviewStatus !== 'approved')) && <p className="content-notice" role="status">{bank.errors.length ? `Question bank needs correction: ${bank.errors.join(' ')}` : bank.questions.length ? `${bank.questions.length} generated questions await teacher review. The pacing guide is imported; use Question Review to approve questions and enable play.` : 'No approved local questions are available. Add reviewed curriculum-backed questions to enable play.'}</p>}
    </main>}
    {screen === 'setup' && <main className="setup">
      <div className="eyebrow">JEOPARDY / QUICK SETUP</div>{state.contentSource !== 'drafts' && classroomBank.questions.length > 0 && <p className="hint">{PACK_NAME} · Automated checks + editorial review</p>}<h1 ref={title} tabIndex={-1}>Let’s get your class playing.</h1>
      <fieldset><legend>1 <span>Select grade</span></legend><div className="grade-options">{grades.map(g => <button key={g} aria-pressed={state.grade === g} onClick={() => update({ grade: g })}>{gradeLabel(g)}</button>)}</div></fieldset>
      <fieldset><legend>2 <span>Current + Review</span></legend><p className="pacing-note" data-testid="jeopardy-pacing-window">{pacingWindow ? <>Current = taught {shortDate(pacingWindow.start)} – {shortDate(pacingWindow.end)}. Review = taught before {shortDate(pacingWindow.start)}.</> : 'Choose a valid date.'} Subject columns use Current questions first and fill any gaps with Review questions. The Review column uses Review questions and taught questions marked for review. Week-only evidence counts as taught on that week’s Friday.</p>
        {planningAhead(state.asOf) && <p className="content-notice" role="status" data-testid="planning-ahead">{PLANNING_AHEAD}</p>}
        {!!available && !currentCount && <p className="content-notice" role="status">No Current questions yet for {gradeLabel(state.grade)} on this date. The board will use Review questions.</p>}</fieldset>
      <div className="setup-bottom"><label>Teaching date <input aria-label="Teaching date" type="date" value={state.asOf} onChange={e => { if (e.target.value) update({ asOf: e.target.value }); }} /></label><p>Content taught after this date is always excluded.<br /><strong>{available} approved questions available · {currentCount} Current · {available - currentCount} Review</strong></p><button className="primary" disabled={!plan.complete} onClick={() => startGame(state.grade, 'mixed')}>Start Game →</button></div>
      {!!available && !plan.complete && <p className="content-notice" role="status">Classroom game not ready: {plan.matched}/30 tiles can be filled with unique approved questions. {state.contentSource !== 'drafts' && classroomBank.questions.length ? 'Additional supported content is needed in the missing pools.' : 'Review more questions or change the content range.'}</p>}
      {!available && <div className="content-notice" role="status">No questions available for this selection. {bank.questions.length ? questions.every(q => q.reviewStatus !== 'approved') ? 'Generated questions are awaiting teacher review and approval in the local bank.' : 'Try another grade or teaching date.' : 'Add reviewed local questions to enable play.'}</div>}
      {!plan.complete && classroomBank.questions.length > 0 && <p className="content-notice">{plan.matched}/30 tiles supported. Missing pools: {[...new Set(tiles.filter(t => !plan.assignments[t.id]).map(t => `${t.category} ${t.difficulty}-point`))].join(' · ')}. Unsupported slots remain unfilled.</p>}
      <p className="hint">Students answer aloud, on paper, or with classroom response tools. You lead the game.</p>
    </main>}
    {active && blockedBoard && <p className="content-notice" role="alert">This board needs a new eligibility check because approval or curriculum data changed. Go Home to Question Review, or reset if a complete approved board is available.</p>}
    {screen === 'board' && !blockedBoard && <main className="board-screen">
      <div className="board-heading"><div><div className="eyebrow">JEOPARDY</div><h1 ref={title} tabIndex={-1}>Choose your challenge.</h1></div><p>{state.range === 'mixed' ? `Current + Review · Teaching date ${state.asOf}${planningAhead(state.asOf) ? ' · Planning ahead' : ''}` : `${state.range === 'recent' ? 'Recent content' : 'Everything taught so far'} · Through ${state.asOf}`}<br /><strong>{state.usedTiles.length} / 30 tiles played</strong></p></div>
      <div className="board">{categories.map(category => <section className="board-column" key={category} aria-label={category}><h2>{category.toUpperCase()}</h2>{tiles.filter(t => t.category === category).map(tile => {
        const used = state.usedTiles.includes(tile.id), count = state.assignments ? engine.getQuestions({ ...filters, subject: category, difficulty: tile.difficulty }).filter(q => q.id === state.assignments?.[tile.id]).length : engine.getAvailableQuestionCount({ ...filters, subject: category, difficulty: tile.difficulty });
        const fromReview = reviewTag(state.assignments?.[tile.id], category);
        return <button className={`tile ${used ? 'used' : ''}`} data-from-review={fromReview || undefined} key={tile.id} disabled={used || !count} aria-label={`${category} ${tile.difficulty} ${tile.difficulty === 1 ? 'point' : 'points'} opportunity ${Number(tile.id.slice(-1)) + 1}${fromReview ? ' Review' : ''}${used ? ' used' : !count ? ' no questions available' : ''}`} onClick={() => choose(tile)}>{used ? <span>✓ USED</span> : !count ? <span>NO QUESTIONS<br />AVAILABLE</span> : <><strong>{tile.difficulty}</strong><span>{tile.difficulty === 1 ? 'POINT' : 'POINTS'}</span></>}</button>;
      })}</section>)}</div>
      <footer>{state.usedTiles.length === 30 || !tiles.some(t => !state.usedTiles.includes(t.id) && engine.getAvailableQuestionCount({ ...filters, subject: t.category, difficulty: t.difficulty })) ? 'All available challenges completed. Reset for a new class or change your selection.' : 'Choose a tile · Answer together · Reveal & discuss'}<span>{state.range === 'mixed' ? 'Subjects use Current first, then Review (tagged). The Review column uses Review and taught review-marked questions.' : 'Review uses marked review questions or earlier content.'}</span></footer>
    </main>}
    {screen === 'question' && !blockedBoard && current && <main className="question-screen">
      <div className="question-meta"><span>{state.current?.category.toUpperCase()}{state.current?.category === 'Review' ? ` · ${current.subject.toUpperCase()}` : ''}</span><span className="points">{current.difficulty} {current.difficulty === 1 ? 'POINT' : 'POINTS'}</span></div>
      <div className="read-note">{state.grade === 'K' ? 'TEACHER READS QUESTION ALOUD' : state.grade === '1' ? 'TEACHER MAY READ QUESTION ALOUD' : current.teacherRead ? 'TEACHER READS QUESTION ALOUD' : 'THINK IT THROUGH. SHARE YOUR ANSWER.'}</div>
      {current.teacherSetup && <p className="teacher-setup">Teacher preparation: {current.teacherSetup}</p>}
      <div className={`question-content ${current.question.length > 180 ? 'long' : ''}`}><h1 ref={title} tabIndex={-1}>{current.question}</h1>{!state.current?.revealed && current.choices && <div className="choices">{current.choices.map((c, i) => <div key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>)}</div>}
        {state.current?.revealed && <div className="answer" role="status"><span>CORRECT ANSWER</span><p>{current.answer}</p></div>}</div>
      <div className="question-bottom">{state.current?.revealed ? <button className="primary" onClick={() => update({ screen: 'board', current: null })}>Back to Board →</button> : <button className="primary" onClick={() => update({ current: { ...state.current!, revealed: true } })}>Reveal Answer</button>}<span>{current.standard} · {current.source}</span></div>
    </main>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="confirm-title"><h2 id="confirm-title">{confirm === 'reset' ? 'Reset this game?' : 'Change grade or content?'}</h2><p>{confirm === 'reset' ? 'Clear played tiles and used questions for a fresh class. Your grade, range, and content date stay the same.' : 'This ends the current game and clears its progress. Choose a new grade or content range in setup.'}</p><div className="dialog-actions"><button autoFocus onClick={() => setConfirm(null)}>Keep Playing</button><button className="primary" onClick={() => { fresh(confirm === 'reset' ? 'board' : 'setup'); setConfirm(null); }}>{confirm === 'reset' ? 'Reset Game' : 'Change Grade'}</button></div></dialog>
  </div>;
}
