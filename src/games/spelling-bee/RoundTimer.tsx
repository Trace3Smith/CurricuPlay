import { useEffect, useRef, useState } from 'react';
import { formatTimer, timerDurations, timerRemaining, type RoundTimer as Timer } from './timer';

export default function RoundTimer({ timer, locked, onAction }: {
  timer: Timer; locked: boolean;
  onAction: (action: 'start' | 'pause' | 'reset' | 'end' | 'tick', duration?: number) => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [audioNote, setAudioNote] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef(timer.status);
  const left = timerRemaining(timer, now);
  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    const interval = window.setInterval(sync, 200);
    window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(interval); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  useEffect(() => { if (timer.status === 'running' && left === 0) onAction('tick'); }, [timer.status, left, onAction]);
  useEffect(() => {
    if (timer.status === 'expired' && previous.current !== 'expired') {
      const ctx = audio.current;
      if (ctx?.state === 'running') {
        // Two short, gentle tones; no remote audio file or network dependency.
        for (const offset of [0, 0.32]) {
          const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + offset;
          osc.frequency.value = 660; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.15, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, at + 0.24); osc.connect(gain); gain.connect(ctx.destination); osc.start(at); osc.stop(at + 0.25);
        }
      } else setAudioNote('Sound unavailable after interruption. Use the visible stop signal.');
    }
    previous.current = timer.status;
  }, [timer.status]);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);
  async function enableSound() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume(); setAudioNote('Sound ready. Check your speaker volume.');
    } catch { setAudioNote('Sound unavailable. Use the visible stop signal.'); }
  }
  const stopped = timer.status === 'expired' || timer.status === 'ended';
  return <section className={`bee-timer ${stopped ? 'bee-time-up' : ''}`} aria-label="Round countdown">
    <div className="bee-clock"><span role="timer" aria-label="Time remaining" aria-live="off">{formatTimer(left)}</span><strong role="status">{timer.status === 'expired' ? 'TIME’S UP — STOP WORKING' : timer.status === 'ended' ? 'ROUND ENDED — STOP WORKING' : timer.status === 'paused' ? 'PAUSED — WAIT' : timer.status === 'ready' ? 'READY — WAIT FOR START' : 'WORK TOGETHER'}</strong></div>
    <div className="bee-timer-controls">
      <label>Round duration<select aria-label="Round duration" disabled={locked || timer.status !== 'ready'} value={timer.duration} onChange={e => { setNow(Date.now()); onAction('reset', Number(e.target.value)); }}>{timerDurations.map(s => <option key={s} value={s}>{formatTimer(s * 1000)}</option>)}</select></label>
      <button disabled={locked || stopped} onClick={() => { setNow(Date.now()); if (timer.status === 'running') onAction('pause'); else { void enableSound(); onAction('start'); } }}>{timer.status === 'running' ? 'Pause Timer' : timer.status === 'paused' ? 'Resume Timer' : 'Start Timer'}</button>
      <button disabled={locked} onClick={() => { setNow(Date.now()); onAction('reset'); }}>Reset Timer</button>
      <button disabled={locked || stopped} onClick={() => { setNow(Date.now()); onAction('end'); }}>Teacher: End Round Early</button>
      <button className="bee-sound" onClick={() => void enableSound()}>Enable Timer Sound</button>
    </div>
    <p className="bee-timer-note">{audioNote || 'Start enables the end signal. After a refresh, tap Enable Timer Sound.'} Reset clears uncommitted team marks.</p>
  </section>;
}
