import { useEffect, useRef, useState } from 'react';
import { restoreMovementTimer, saveMovementTimer, secondsRemaining, type TimerPhase } from './movementTimer';

/** Presentation-only countdown. It has no access to reveal, score, or assessment callbacks. */
export default function MovementTimer({ roundKey, duration }: { roundKey: string; duration: number }) {
  const [restored] = useState(() => restoreMovementTimer(roundKey, duration));
  const [phase, setPhase] = useState<TimerPhase>(restored.phase);
  const [remaining, setRemaining] = useState(restored.phase === 'expired' ? 0 : duration);
  const [resetNotice, setResetNotice] = useState(restored.reset);
  const [saved, setSaved] = useState(true);
  const deadline = useRef(0);
  useEffect(() => { setSaved(saveMovementTimer(roundKey, duration, phase)); }, [roundKey, duration, phase]);
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const seconds = secondsRemaining(deadline.current, performance.now());
      setRemaining(seconds);
      if (seconds === 0) setPhase('expired');
    };
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [phase]);
  function start() {
    deadline.current = performance.now() + duration * 1000;
    setResetNotice(false); setRemaining(duration); setPhase('running');
  }
  function cancel() { setResetNotice(false); setRemaining(duration); setPhase('idle'); }
  return <section className={`fc-movement-timer fc-timer-${phase}`} aria-label="Movement timer">
    <div className="fc-timer-count" role="timer" aria-label="Movement countdown" aria-live="off">{phase === 'expired' ? 'TIME!' : remaining}</div>
    <div className="fc-timer-instructions"><strong>{phase === 'running' ? 'MOVE TO YOUR CORNER' : phase === 'expired' ? 'STOP AT YOUR CORNER' : 'MOVEMENT TIMER'}</strong>
      <p role="status">{resetNotice ? 'Timer reset after returning. Start when ready.' : phase === 'expired' ? 'Teacher reveals the answer when ready.' : 'Teacher starts after reading. Silent countdown.'}</p>
      {!saved && <p role="alert">Timer cannot be saved. It will reset after refresh.</p>}
    </div>
    <div className="fc-timer-buttons"><button onClick={start}>{phase === 'idle' ? 'Start' : 'Restart'} {duration} Seconds</button><button disabled={phase === 'idle'} onClick={cancel}>Cancel Timer</button></div>
  </section>;
}
