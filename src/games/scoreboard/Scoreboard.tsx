import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { addPoints, displayName, fitGrid, leaders, loadState, MAX_TEAMS, MIN_TEAMS, NAME_LIMIT, recolor, rename, resetScores, saveState, scoreboardColors, setCount, setStep, STEPS, textOn, undo, type ScoreState } from './engine';
import '../board-mode.css';
import './scoreboard-board.css';

// The same gap is used to measure and to lay out the tiles, so a row never wraps early.
const tileGap = (count: number) => count > 8 ? 12 : 20;
const MIN_TILE_HEIGHT = 140, MIN_TILE_WIDTH = 150;
// Tile sizes come from the measured space (not CSS container units) so older Smart Board browsers size them correctly.
function tileStyle(w: number, h: number): CSSProperties {
  const px = (v: number) => `${Math.round(v)}px`;
  const band = Math.max(30, Math.min(h * .18, w * .16)), buttons = Math.max(48, Math.min(h * .26, 132)), pad = Math.max(8, Math.min(w, h) * .05);
  return { width: px(w), height: px(h), '--sb-band': px(band), '--sb-name': px(Math.max(20, band * .62)), '--sb-btn-h': px(buttons),
    '--sb-btn-text': px(Math.max(24, Math.min(buttons * .55, w * .1))), '--sb-pad': px(pad),
    '--sb-score': px(Math.max(28, Math.min((h - band - buttons - pad * 3) * .95, w * .38))) } as CSSProperties;
}

export default function Scoreboard({ onHome, onClassroom }: { onHome: () => void; onClassroom: () => void }) {
  const [state, setState] = useState<ScoreState>(loadState);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState<'teams' | 'reset' | null>(null);
  const [grid, setGrid] = useState({ columns: 1, width: 0, height: 0, scroll: false });
  const [bumped, setBumped] = useState<{ team: number; at: number } | null>(null);
  const board = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setSaved(saveState(state)); }, [state]);
  useEffect(() => { document.title = 'Scoreboard · ClassThread'; }, []);
  useEffect(() => { if (panel) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [panel]);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const fit = () => {
      const gap = tileGap(state.count), css = getComputedStyle(el);
      // clientWidth rounds up on scaled screens; measure the exact box and leave a pixel so a row never wraps early.
      const box = el.getBoundingClientRect();
      const width = Math.floor(box.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)) - 1;
      const height = Math.floor(box.height - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom)) - 1;
      const best = fitGrid(state.count, width, height, gap);
      // Too small to read (a phone with many teams): keep tiles readable and let the board scroll instead.
      if (best.height >= MIN_TILE_HEIGHT && best.width >= MIN_TILE_WIDTH) { setGrid({ ...best, scroll: false }); return; }
      const columns = Math.max(1, Math.min(state.count, Math.floor((width + gap) / (MIN_TILE_WIDTH + gap))));
      setGrid({ columns, width: Math.floor((width - (columns - 1) * gap) / columns), height: MIN_TILE_HEIGHT, scroll: true });
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(el);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, [state.count]);
  // Keep the board awake during a game where the browser allows it; optional, so failures are ignored.
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible') void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }).wakeLock?.request('screen').catch(() => undefined); };
    wake(); document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, []);

  function score(team: number, delta: number) { setState(s => addPoints(s, team, delta)); if (delta > 0) setBumped({ team, at: Date.now() }); }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Use your browser’s full-screen control (usually F11).'); }
  }
  const lead = leaders(state);
  const tied = lead.length > 1;
  const shown = state.teams.slice(0, state.count);
  const style = grid.width ? tileStyle(grid.width, grid.height) : undefined;

  return <div className="app sb-app board-mode" onContextMenu={e => { if ((e.target as HTMLElement).closest('.sb-board,.sb-controls')) e.preventDefault(); }}>
    <header><button className="wordmark" onClick={onHome} aria-label="ClassThread Games home"><img src="/branding/classthread-logo-dark.png" alt="" width="800" height="155" /></button>
      <div className="header-actions"><button onClick={onClassroom}>My Classroom</button><button onClick={onHome}>Home</button><button onClick={fullscreen}>Full Screen</button></div>
    </header>
    {!saved && <p role="alert" className="warning">Scores cannot be saved in this browser. Keep this tab open during class.</p>}
    {notice && <p role="status" className="warning">{notice}</p>}

    <main className={`sb-board ${grid.scroll ? 'sb-scroll' : ''}`} style={{ gap: `${tileGap(state.count)}px` }} ref={board} aria-label="Scores" data-testid="sb-board">
      {shown.map((team, i) => {
        const color = scoreboardColors[team.color].accent, name = displayName(team, i), leading = lead.includes(i);
        return <section key={i} className={`sb-tile ${leading ? 'sb-lead' : ''}`} style={style} data-testid={`sb-team-${i + 1}`} aria-label={`${name}: ${team.score} ${team.score === 1 ? 'point' : 'points'}${leading ? tied ? ', tied for the lead' : ', leading' : ''}`}>
          <div className="sb-band" style={{ background: color, color: textOn(color) }}><span className="sb-name">{name}</span>{leading && <span className="sb-chip">{tied ? 'TIED' : 'LEADS'}</span>}</div>
          <div key={bumped?.team === i ? bumped.at : 0} className={`sb-score ${bumped?.team === i ? 'sb-bump' : ''}`} data-testid={`sb-score-${i + 1}`}>{team.score}</div>
          <div className="sb-buttons">
            <button className="sb-minus" disabled={team.score === 0} aria-label={`Take ${state.step} from ${name}`} onClick={() => score(i, -state.step)}>−{state.step}</button>
            <button className="sb-plus" aria-label={`Add ${state.step} to ${name}`} onClick={() => score(i, state.step)}>+{state.step}</button>
          </div>
        </section>;
      })}
    </main>

    <footer className="sb-controls">
      <div className="sb-steps" role="group" aria-label="Points per tap"><span>Points per tap</span>{STEPS.map(step => <button key={step} aria-pressed={state.step === step} onClick={() => setState(s => setStep(s, step))}>{step}</button>)}</div>
      <div className="sb-actions"><button disabled={!state.history.length} onClick={() => setState(undo)}>Undo</button><button onClick={() => setPanel('teams')}>Teams ({state.count})</button><button onClick={() => setPanel('reset')}>Reset</button></div>
    </footer>

    <dialog ref={dialog} className="sb-dialog" onCancel={() => setPanel(null)} onClose={() => setPanel(null)} aria-labelledby="sb-dialog-title">
      {panel === 'reset' && <>
        <h2 id="sb-dialog-title">Reset all scores to 0?</h2>
        <p>Team names and colors stay. Undo brings the scores back.</p>
        <div className="sb-dialog-actions"><button autoFocus onClick={() => setPanel(null)}>Keep Scores</button><button className="sb-danger" onClick={() => { setState(resetScores); setPanel(null); }}>Reset Scores</button></div>
      </>}
      {panel === 'teams' && <>
        <h2 id="sb-dialog-title">Teams</h2>
        <div className="sb-count"><button aria-label="Fewer teams" disabled={state.count <= MIN_TEAMS} onClick={() => setState(s => setCount(s, s.count - 1))}>−</button><output aria-live="polite" data-testid="sb-count">{state.count}</output><button aria-label="More teams" disabled={state.count >= MAX_TEAMS} onClick={() => setState(s => setCount(s, s.count + 1))}>+</button>
          <p>{MIN_TEAMS}–{MAX_TEAMS} teams. A hidden team keeps its score if you add it back.</p></div>
        <div className="sb-team-rows">{shown.map((team, i) => <div key={i} className="sb-team-row">
          <i className="sb-swatch" style={{ background: scoreboardColors[team.color].accent }} aria-hidden="true" />
          <input id={`sb-name-${i + 1}`} aria-label={`Name for team ${i + 1}`} maxLength={NAME_LIMIT} placeholder={`Team ${i + 1}`} value={team.name} onChange={e => setState(s => rename(s, i, e.target.value))} />
          <select id={`sb-color-${i + 1}`} aria-label={`Color for team ${i + 1}`} value={team.color} onChange={e => setState(s => recolor(s, i, Number(e.target.value)))}>{scoreboardColors.map((c, ci) => <option key={c.name} value={ci}>{c.name}</option>)}</select>
        </div>)}</div>
        <div className="sb-dialog-actions"><button className="sb-done" autoFocus onClick={() => setPanel(null)}>Done</button></div>
      </>}
    </dialog>
  </div>;
}
