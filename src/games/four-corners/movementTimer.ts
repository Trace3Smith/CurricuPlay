export const movementDurations = [0, 10, 15, 20] as const;
export type MovementDuration = typeof movementDurations[number];
export type TimerPhase = 'idle' | 'running' | 'expired';
export const TIMER_KEY = 'curricuplay.four-corners.timer.v1';
export function movementDuration(value: unknown): MovementDuration {
  return movementDurations.includes(value as MovementDuration) ? value as MovementDuration : 10;
}
export function secondsRemaining(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function restoreMovementTimer(roundKey: string, duration: number): { phase: TimerPhase; reset: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null');
    if (saved?.version === 1 && saved.roundKey === roundKey && saved.duration === duration) {
      if (saved.phase === 'expired') return { phase: 'expired', reset: false };
      // No wall-clock inference after navigation/reload: the teacher must explicitly restart.
      if (saved.phase === 'running') return { phase: 'idle', reset: true };
    }
  } catch { /* A missing/corrupt timer must never block the game. */ }
  return { phase: 'idle', reset: false };
}
export function saveMovementTimer(roundKey: string, duration: number, phase: TimerPhase): boolean {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify({ version: 1, roundKey, duration, phase })); return true; }
  catch { return false; }
}
