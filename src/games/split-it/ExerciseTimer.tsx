import { useEffect, useRef, useState } from 'react';
import { secondsRemaining } from '../four-corners/movementTimer';

/** Movement On: a teacher-started exercise countdown for the word on the board. Presentation only: it never checks,
 * scores or moves the game on, and it starts again (idle) for each word. Uses Four Corners' monotonic countdown. */
export default function ExerciseTimer({ duration }: { duration: number }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [remaining, setRemaining] = useState(duration);
  const deadline = useRef(0);
  useEffect(() => {
    if (phase !== 'running') return;
    const interval = window.setInterval(() => {
      const seconds = secondsRemaining(deadline.current, performance.now());
      setRemaining(seconds);
      if (seconds === 0) setPhase('done');
    }, 100);
    return () => window.clearInterval(interval);
  }, [phase]);
  function start() { deadline.current = performance.now() + duration * 1000; setRemaining(duration); setPhase('running'); }
  return <section className={`si-timer si-timer-${phase}`} aria-label="Exercise timer">
    <strong>{phase === 'running' ? 'EXERCISE!' : phase === 'done' ? 'TIME!' : 'EXERCISE TIMER'}</strong>
    <span className="si-timer-count" role="timer" aria-label="Exercise countdown" aria-live="off">{phase === 'done' ? 0 : remaining}</span>
    <button onClick={start}>{phase === 'idle' ? 'Start' : 'Restart'} {duration} s</button>
  </section>;
}
