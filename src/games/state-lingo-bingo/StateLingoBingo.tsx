import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import AssessmentDialog from '../../assessment/AssessmentDialog';
import AssessmentView from '../../assessment/AssessmentView';
import TeamName from '../../assessment/TeamName';
import { saveCompletedSession } from '../../assessment/storage';
import shapes from '../../data/state-shapes.json' with { type: 'json' };
import {
  beginGame, bingoGrades, boardLayout, buildSession, cardSizes, defaultSize, defaultTeamName, endGame, FITNESS_LIMIT, freshState, judge, MAX_TEAMS, MIN_TEAMS,
  NAME_LIMIT, pool, progress, regions, report, setTarget, setupErrors, squareModes, stateByCode, states, statesNeeded, undo,
  type BingoState, type Region, type Scoring, type Settings, type SquareMode,
} from './engine';
import { discardActive, readActive, saveActive } from './storage';
import './state-lingo-bingo.css';

const gradeLabel = (g: string) => `${g}${g === '3' ? 'rd' : 'th'} Grade`;
const modeLabels: Record<SquareMode, string> = { names: 'Names', outline: 'Map-only: outline', location: 'Map-only: location' };
const scoringLabels: Record<keyof Scoring, string> = { capital: 'Points per correct capital', line: 'Bonus per bingo line', blackout: 'Blackout bonus' };
const fipsByCode = new Map(states.map(s => [s.code, s.fips]));
type Shape = { d: string; bbox: number[] };
const shapeFor = (code: string) => (shapes.states as Record<string, Shape>)[fipsByCode.get(code)!];

/** Every state path is defined once; squares reference it, so ten cards stay light. */
function ShapeDefs() {
  return <svg className="slb-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    {states.map(s => <path key={s.code} id={`slb-${s.code}`} d={shapeFor(s.code).d} vectorEffect="non-scaling-stroke" />)}
    <g id="slb-us">{states.map(s => <use key={s.code} href={`#slb-${s.code}`} />)}</g>
  </defs></svg>;
}
/** Each outline is drawn at its own scale so small states stay recognizable. */
function StateArt({ code, mode }: { code: string; mode: SquareMode }) {
  if (mode === 'location') return <svg className="slb-art slb-location" viewBox={shapes.viewBox.join(' ')} aria-hidden="true" focusable="false"><use className="slb-us" href="#slb-us" /><use className="slb-shape-hl" href={`#slb-${code}`} /></svg>;
  const [x, y, w, h] = shapeFor(code).bbox, pad = Math.max(w, h) * 0.08;
  return <svg className={`slb-art ${mode === 'outline' ? 'slb-solo' : ''}`} viewBox={`${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`} aria-hidden="true" focusable="false"><use className="slb-shape" href={`#slb-${code}`} /></svg>;
}
// The longest words get a soft hyphen; it shows only if the word doesn't fit on one line.
const breaks: Record<string, string> = {
  Massachusetts: 'Massa­chusetts', Pennsylvania: 'Pennsyl­vania', Connecticut: 'Connecti­cut', Washington: 'Washing­ton',
  Mississippi: 'Missis­sippi', Hampshire: 'Hamp­shire',
};
const squareText = (name: string) => name.split(' ').map(w => breaks[w] ?? w).join(' ');
const longName = (name: string) => name.split(' ').some(w => w.length >= 9);
const LINE = 1.2, FLOOR_VH = 1;

// Width of text in em, measured in the font this browser actually renders (fonts differ by computer).
const widths = new Map<string, number>();
let ruler: HTMLSpanElement | null = null;
function emWidth(text: string, family: string, spacing: number): number {
  const key = `${family}|${spacing}|${text}`;
  if (!widths.has(key)) {
    ruler ??= Object.assign(document.body.appendChild(document.createElement('span')), { ariaHidden: 'true' });
    Object.assign(ruler.style, { position: 'fixed', left: '-10000px', top: '-10000px', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: '100px', fontWeight: '700', fontFamily: family, letterSpacing: `${spacing}em` });
    ruler.textContent = text;
    const width = ruler.getBoundingClientRect().width / 100;
    // Only cache once the font has loaded; a fallback-font width would be wrong.
    if (!document.fonts || document.fonts.check(`700 16px ${family}`)) widths.set(key, width);
    return width;
  }
  return widths.get(key)!;
}
/** One font size per card: the largest at which every name on it fits its square, never below the floor. */
function fitCards(board: HTMLElement) {
  for (const card of board.querySelectorAll<HTMLElement>('.slb-card')) {
    const names = [...card.querySelectorAll<HTMLElement>('.slb-square:not(.slb-free) .slb-name')];
    const square = names[0]?.parentElement;
    if (!square) { card.style.removeProperty('--card-font'); continue; }
    const family = getComputedStyle(names[0]).fontFamily;
    const w = square.clientWidth * 0.96 - 2, h = square.clientHeight * 0.92;
    let size = Math.min(0.3 * square.clientWidth, 0.3 * square.clientHeight);
    for (const el of names) {
      const name = el.dataset.name!, spacing = el.classList.contains('slb-long') ? -0.02 : 0;
      let lines = 0;
      for (const word of name.split(' ')) {
        const whole = emWidth(word, family, spacing);
        const pieces = breaks[word]?.split('­');
        const split = pieces ? Math.max(emWidth(`${pieces[0]}-`, family, spacing), emWidth(pieces[1], family, spacing)) : Infinity;
        size = Math.min(size, w / Math.min(whole, split));
        lines += pieces && w / whole < size ? 2 : 1;
      }
      size = Math.min(size, h / (lines * LINE));
    }
    card.style.setProperty('--card-font', `${Math.max(size, innerHeight * FLOOR_VH / 100).toFixed(2)}px`);
  }
}
/** Names sit over a faint outline; map-only modes show the shape or location with no name. */
function StateFace({ code, mode, square = false }: { code: string; mode: SquareMode; square?: boolean }) {
  const name = stateByCode.get(code)!.name, words = name.split(' ');
  // Card squares share one size set by the square; the target and pop-up fit their single name.
  const fit = square ? undefined : { '--len': Math.max(5, ...words.map(w => w.length)), '--lines': words.length } as CSSProperties;
  return <><StateArt code={code} mode={mode} />{mode === 'names' && <span className={`slb-name ${square && longName(name) ? 'slb-long' : ''}`} style={fit} data-name={square ? name : undefined}>{square ? squareText(name) : name}</span>}</>;
}
/** Event times never go backwards, so a clock change cannot invalidate a saved game. */
function stamp(s: BingoState): string {
  const now = Date.now(), last = Math.max(Date.parse(s.events?.at(-1)?.at ?? s.startedAt ?? ''), 0);
  return new Date(Math.max(now, last)).toISOString();
}

export default function StateLingoBingo({ onHome, onClassroom }: { onHome: () => void; onClassroom: () => void }) {
  const [initial] = useState(readActive);
  const [state, setState] = useState<BingoState>(() => initial.state ?? freshState());
  const [loadError, setLoadError] = useState(initial.error);
  const [saveError, setSaveError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [peek, setPeek] = useState(false);
  const [popup, setPopup] = useState<{ team: string; code: string; key: number } | null>(null);
  const [flash, setFlash] = useState<{ team: string; text: string; key: number } | null>(null);
  const [confirm, setConfirm] = useState<'end' | 'discard' | null>(null);
  const [panel, setPanel] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const board = useRef<HTMLElement>(null);
  // An unreadable save is never overwritten until the teacher discards it.
  useEffect(() => { if (!loadError) setSaveError(saveActive(state)); }, [state, loadError]);
  const session = useMemo(() => state.screen === 'setup' ? null : buildSession(state), [state]);
  useEffect(() => { if (session?.endedAt) setHistoryError(saveCompletedSession(session)); }, [session]);
  useEffect(() => { title.current?.focus(); }, [state.screen]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);
  useEffect(() => { if (!popup) return; const t = setTimeout(() => setPopup(null), 3000); return () => clearTimeout(t); }, [popup]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 2600); return () => clearTimeout(t); }, [flash]);
  // Refit names whenever a card's squares change size (screen size, a target appearing or clearing).
  useLayoutEffect(() => {
    const b = board.current;
    if (!b) return;
    const run = () => fitCards(b);
    run();
    const observer = new ResizeObserver(run);
    b.querySelectorAll('.slb-card').forEach(card => observer.observe(card));
    void document.fonts?.load(`700 16px 'Barlow Condensed'`).then(run, run);
    return () => observer.disconnect();
  }, [state.screen, state.sessionId, state.settings.squareMode]);

  const settings = state.settings;
  function updateSettings(patch: Partial<Settings>) { setState(s => s.screen === 'setup' ? { ...s, settings: { ...s.settings, ...patch } } : s); }
  const errors = setupErrors(settings);
  function start() {
    const next = beginGame(settings, crypto.randomUUID(), new Date().toISOString());
    if (next) { setState(next); setSelected(null); setChoosing(false); setHistoryError(''); }
  }
  function select(teamId: string) { setSelected(teamId); setChoosing(false); setPeek(false); }
  function target(teamId: string, code: string) {
    const next = setTarget(state, teamId, code, stamp(state));
    if (next === state) return;
    setState(next); setChoosing(false); setPeek(false); setPopup({ team: teamId, code, key: Date.now() });
  }
  function mark(kind: 'correct' | 'wrong') {
    if (!selected) return;
    const before = progress(state, selected), next = judge(state, selected, kind, stamp(state));
    if (next === state) return;
    setState(next); setPeek(false);
    if (kind === 'wrong') { setNotice(`Wrong tile recorded for ${state.teams!.find(t => t.id === selected)!.name}. Back to the pool!`); return; }
    const after = progress(next, selected);
    setNotice('');
    if (after.blackout && !before.blackout) setFlash({ team: selected, text: 'BLACKOUT!', key: Date.now() });
    else if (after.lines > before.lines) setFlash({ team: selected, text: 'BINGO!', key: Date.now() });
    setChoosing(!after.blackout);
  }
  function undoLast() {
    const last = state.events?.at(-1);
    if (!last) return;
    setState(undo(state)); setSelected(last.teamId); setChoosing(false); setPeek(false); setPopup(null); setFlash(null);
    setNotice(`Undid the last tap (${last.kind === 'target' ? 'new target' : last.kind === 'wrong' ? 'wrong tile' : 'correct capital'}) for ${state.teams!.find(t => t.id === last.teamId)!.name}.`);
  }
  function confirmAction() {
    if (confirm === 'end') { setState(s => endGame(s, stamp(s))); setSelected(null); setChoosing(false); }
    else {
      const error = discardActive();
      if (error) { setNotice(error); setConfirm(null); return; }
      setLoadError(''); setState(freshState());
    }
    setConfirm(null);
  }
  function newGame() {
    const error = discardActive();
    if (error) { setNotice(error); return; }
    setState(freshState(state.settings)); setNotice('');
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }

  const playing = state.screen === 'play';
  const teams = state.teams ?? [];
  const selectedTeam = teams.find(t => t.id === selected);
  const selectedProgress = selected ? progress(state, selected) : null;
  const targetState = selectedProgress?.target ? stateByCode.get(selectedProgress.target)! : null;
  const showNames = settings.squareMode === 'names';
  const [cols, rows] = boardLayout(teams.length || settings.teamCount);

  return <div className={`app slb-app ${playing ? 'slb-playing' : ''}`}>
    <ShapeDefs />
    <header><button className="wordmark" onClick={onHome} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button>
      <div className="header-actions"><button onClick={onClassroom}>My Classroom</button>
        {playing && <><button disabled={!state.events?.length} onClick={undoLast}>Undo</button><button onClick={() => setPanel(true)}>Assessment</button><button onClick={() => setConfirm('end')}>End Game</button></>}
        <button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {loadError && <div role="alert" className="warning">{loadError} Progress will not be saved until you choose what to do with it. <button onClick={() => setConfirm('discard')}>Discard saved game</button></div>}
    {saveError && !loadError && <div role="alert" className="warning">{saveError}</div>}
    {historyError && <div role="alert" className="warning">{historyError} <button onClick={() => session && setHistoryError(saveCompletedSession(session))}>Retry Save</button></div>}

    {state.screen === 'setup' && <main className="slb-setup">
      <div className="eyebrow">STATE LINGO BINGO / SETUP</div>
      <h1 ref={title} tabIndex={-1}>Roll. Move. Dig for the capital.</h1>
      <p className="slb-practice" data-testid="general-practice">General Practice · Not district-paced · Available on any date</p>
      <div className="slb-setup-grid">
        <fieldset><legend>1 <span>Grade</span></legend><div className="slb-options">{bingoGrades.map(g => <button key={g} aria-pressed={settings.grade === g} onClick={() => updateSettings({ grade: g, size: defaultSize(g, settings.teamCount) })}>{gradeLabel(g)}</button>)}</div></fieldset>
        <fieldset><legend>2 <span>Teams and card</span></legend><div className="slb-options">
          <label>Teams <select aria-label="Number of teams" value={settings.teamCount} onChange={e => updateSettings({ teamCount: Number(e.target.value), size: defaultSize(settings.grade, Number(e.target.value)) })}>{Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => i + MIN_TEAMS).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          {cardSizes.map(size => <button key={size} aria-pressed={settings.size === size} onClick={() => updateSettings({ size })}>{size}×{size}{size === 5 ? ' · free center' : ''}</button>)}
        </div><p className="slb-hint">Default: 4×4 for 3rd grade or 7+ teams; 5×5 for 4th and 5th with 6 or fewer teams. You can change it.</p></fieldset>
        <fieldset><legend>3 <span>Regions</span></legend><div className="slb-options">{regions.map(r => <button key={r} aria-pressed={settings.regions.includes(r)} onClick={() => updateSettings({ regions: settings.regions.includes(r) ? settings.regions.filter(x => x !== r) : regions.filter(x => x === r || settings.regions.includes(x)) as Region[] })}>{r} · {pool([r]).length}</button>)}</div>
          <p className="slb-hint" data-testid="region-count">{pool(settings.regions).length} states selected · a {settings.size}×{settings.size} card needs {statesNeeded(settings.size)}.</p></fieldset>
        <fieldset><legend>4 <span>Squares show</span></legend><div className="slb-options">{squareModes.map(m => <button key={m} aria-pressed={settings.squareMode === m} onClick={() => updateSettings({ squareMode: m })}>{modeLabels[m]}</button>)}</div></fieldset>
        <fieldset><legend>5 <span>Scoring</span></legend><div className="slb-inputs">{(Object.keys(scoringLabels) as (keyof Scoring)[]).map(k => <label key={k}>{scoringLabels[k]} <input type="number" min={0} max={100} step={1} value={settings.scoring[k]} onChange={e => updateSettings({ scoring: { ...settings.scoring, [k]: e.target.value === '' ? NaN : Number(e.target.value) } })} /></label>)}</div></fieldset>
        <fieldset><legend>6 <span>Fitness card</span></legend><div className="slb-inputs">{settings.fitness.map((f, i) => <label key={i}>Roll {i + 1} <input aria-label={`Fitness card roll ${i + 1}`} maxLength={FITNESS_LIMIT} value={f} onChange={e => updateSettings({ fitness: settings.fitness.map((x, j) => j === i ? e.target.value : x) })} /></label>)}</div></fieldset>
        <fieldset className="slb-names"><legend>7 <span>Team names</span></legend><p className="slb-hint">Optional. Up to {NAME_LIMIT} characters. Saved only with this game.</p><div className="slb-inputs">{Array.from({ length: settings.teamCount }, (_, i) => <label key={i}><TeamName team={{ id: String(i), name: defaultTeamName(i), accent: undefined }} /> <input aria-label={`Name for ${defaultTeamName(i)}`} placeholder={defaultTeamName(i)} maxLength={NAME_LIMIT} value={settings.names[i]} onChange={e => updateSettings({ names: settings.names.map((n, j) => j === i ? e.target.value : n) })} /></label>)}</div></fieldset>
      </div>
      {errors.length > 0 && <ul className="content-notice" role="status" data-testid="setup-errors">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <div className="setup-bottom"><p>{settings.teamCount} teams · {settings.size}×{settings.size} cards · {pool(settings.regions).length} states</p><button className="primary" disabled={errors.length > 0 || !!loadError} onClick={start}>Start Game →</button></div>
    </main>}

    {playing && <>
      <main ref={board} className="slb-board" aria-label="Bingo cards" style={{ '--cols': cols, '--rows': rows } as CSSProperties}>
        {teams.map((team, index) => {
          const p = progress(state, team.id), card = state.cards![team.id], isSelected = team.id === selected;
          // A short last row is centered: each section spans two of the doubled grid columns.
          const lastRow = teams.length - cols * (rows - 1), start = index === cols * (rows - 1) && lastRow < cols ? cols - lastRow + 1 : undefined;
          return <section key={team.id} className={`slb-team ${isSelected ? 'slb-selected' : ''}`} style={{ '--accent': team.accent, ...(start ? { gridColumn: `${start} / span 2` } : {}) } as CSSProperties} aria-label={team.name} data-testid={`card-${team.id}`}>
            <button className="slb-team-head" aria-pressed={isSelected} onClick={() => select(team.id)}>
              <TeamName team={team} /><span className="slb-stats"><b data-testid={`points-${team.id}`}>{p.score}</b> pts · {p.lines} {p.lines === 1 ? 'bingo' : 'bingos'}{p.blackout ? ' · BLACKOUT' : ''}</span>
            </button>
            <div className={`slb-target ${p.target ? '' : 'slb-target-empty'}`} data-testid={`target-${team.id}`}>{p.target ? <><small>TARGET</small><span className="slb-target-face"><StateFace code={p.target} mode={settings.squareMode} /></span></> : <small>{p.blackout ? 'Card complete!' : 'Choose a target'}</small>}</div>
            <div className="slb-card" style={{ '--size': settings.size } as CSSProperties}>{card.map((code, i) => code === null
              ? <div key={i} className="slb-square slb-free"><span className="slb-name">FREE</span></div>
              : <button key={i} className={`slb-square ${p.marked.has(code) ? 'slb-marked' : ''} ${p.target === code ? 'slb-current' : ''}`} disabled={p.marked.has(code)}
                  aria-label={`${team.name}: ${stateByCode.get(code)!.name}${p.marked.has(code) ? ', marked' : p.target === code ? ', current target' : ''}`}
                  onClick={() => isSelected ? target(team.id, code) : select(team.id)}><StateFace code={code} mode={settings.squareMode} square />{p.marked.has(code) && <i className="slb-check" aria-hidden="true">✓</i>}</button>)}</div>
            {flash?.team === team.id && <div key={flash.key} className="slb-flash" role="status">{flash.text}</div>}
          </section>;
        })}
      </main>
      <section className="slb-controls" aria-label="Teacher controls">
        {!selectedTeam ? <p>Tap a team’s name to judge its tile or choose its target.</p> : <>
          <p aria-live="polite"><TeamName team={selectedTeam} />{' · '}{choosing || !targetState ? <>Tap a square on {selectedTeam.name}’s card to set {choosing ? 'the next' : 'a'} target.</>
            : <>Target: <strong>{showNames || peek ? targetState.name : 'shown on card'}</strong>{peek && <> · Capital: <strong data-testid="peek-capital">{targetState.capital}</strong></>}</>}</p>
          <div className="slb-control-buttons">
            {targetState && !choosing && <><button className="primary" onClick={() => mark('correct')}>✓ Correct capital</button><button className="slb-wrong" onClick={() => mark('wrong')}>✗ Wrong tile</button><button aria-pressed={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide answer' : 'Check answer'}</button></>}
            <button onClick={() => { setSelected(null); setChoosing(false); setPeek(false); }}>Done</button>
          </div></>}
        {notice && <p className="slb-notice" role="status">{notice}</p>}
      </section>
      <ol className="slb-fitness" aria-label="Fitness card">{settings.fitness.map((f, i) => <li key={i}><b>{i + 1}</b>{f}</li>)}</ol>
      {popup && <div key={popup.key} className="slb-popup" aria-hidden="true" data-testid="target-popup" style={{ '--accent': teams.find(t => t.id === popup.team)?.accent } as CSSProperties}>
        <small>{teams.find(t => t.id === popup.team)?.name} · NEW TARGET</small><div className="slb-popup-face"><StateFace code={popup.code} mode={settings.squareMode} /></div></div>}
    </>}

    {state.screen === 'complete' && <Results state={state} onReport={() => setPanel(true)} onNewGame={newGame} onHome={onHome} blocked={!!historyError} titleRef={title} />}
    {panel && session && <AssessmentDialog onClose={() => setPanel(false)}><AssessmentView session={session} live={playing} /></AssessmentDialog>}
    <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="slb-confirm"><h2 id="slb-confirm">{confirm === 'end' ? 'End this game?' : 'Discard the saved game?'}</h2>
      <p>{confirm === 'end' ? 'Show final scores and save the team records to Session History. Play cannot continue after ending.' : 'The saved game in this browser will be deleted. Export your Games data from the Games page first if you need it.'}</p>
      <div className="dialog-actions"><button onClick={() => setConfirm(null)}>Cancel</button><button className="primary" onClick={confirmAction}>{confirm === 'end' ? 'End Game' : 'Discard'}</button></div></dialog>
  </div>;
}

function Results({ state, onReport, onNewGame, onHome, blocked, titleRef }: { state: BingoState; onReport: () => void; onNewGame: () => void; onHome: () => void; blocked: boolean; titleRef: RefObject<HTMLHeadingElement | null> }) {
  const data = report(state), names = new Map(state.teams!.map(t => [t.id, t.name]));
  const ranked = [...data.teams].sort((a, b) => b.score - a.score);
  return <main className="slb-results">
    <div className="eyebrow">STATE LINGO BINGO / FINAL</div><h1 ref={titleRef} tabIndex={-1}>Game over. Great digging!</h1>
    <table className="slb-table"><thead><tr><th>Team</th><th>Points</th><th>Bingos</th><th>Blackout</th><th>Capitals</th><th>Wrong tiles</th><th>Accuracy</th></tr></thead>
      <tbody>{ranked.map(t => <tr key={t.team.id} data-testid={`result-${t.team.id}`}><td><TeamName team={t.team} /></td><td>{t.score}</td><td>{t.lines}</td><td>{t.blackout ? 'Yes' : '—'}</td><td>{t.correct}</td><td>{t.wrong}</td>
        <td>{t.correct + t.wrong ? `${Math.round(t.correct / (t.correct + t.wrong) * 100)}%` : '—'}</td></tr>)}</tbody></table>
    <section className="slb-review" aria-label="Review list"><h2>Review list</h2>{data.review.length ? <ul>{data.review.map((r, i) => {
      const s = stateByCode.get(r.state)!;
      return <li key={i}><strong>{s.name} — {s.capital}</strong> · {names.get(r.teamId)} · {r.reason === 'missed' ? 'wrong tile' : `took ${r.seconds} s`}</li>;
    })}</ul> : <p>No capitals to review.</p>}<p className="slb-hint">Team practice records. They do not show individual mastery.</p></section>
    <div className="assessment-report-actions"><button onClick={onReport}>Session Report</button><button className="primary" disabled={blocked} onClick={onNewGame}>New Game</button><button onClick={onHome}>Back to Games</button></div>
  </main>;
}
