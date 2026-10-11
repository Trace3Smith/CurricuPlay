/** Wall-clock deadlines survive refresh, background throttling, and device sleep. */
export const timerDurations = Array.from({ length: 10 }, (_, i) => (i + 1) * 30);
export interface RoundTimer {
  duration: number;
  status: 'ready' | 'running' | 'paused' | 'expired' | 'ended';
  remainingMs: number;
  deadline: number | null;
}
export const freshTimer = (duration = 300): RoundTimer => ({ duration, status: 'ready', remainingMs: duration * 1000, deadline: null });
export function timerRemaining(timer: RoundTimer, now: number): number {
  return timer.status === 'running' ? Math.max(0, Math.min(timer.duration * 1000, timer.deadline! - now)) : timer.remainingMs;
}
export const timerFinished = (timer: RoundTimer, now: number) => ['expired', 'ended'].includes(timer.status) || (timer.status === 'running' && timerRemaining(timer, now) === 0);
export function advanceTimer(timer: RoundTimer, now: number): RoundTimer {
  return timer.status === 'running' && timerRemaining(timer, now) === 0 ? { ...timer, status: 'expired', remainingMs: 0, deadline: null } : timer;
}
export function startTimer(timer: RoundTimer, now: number): RoundTimer {
  return ['ready', 'paused'].includes(timer.status) ? { ...timer, status: 'running', deadline: now + timer.remainingMs } : timer;
}
export function pauseTimer(timer: RoundTimer, now: number): RoundTimer {
  const current = advanceTimer(timer, now);
  return current.status === 'running' ? { ...current, status: 'paused', remainingMs: timerRemaining(current, now), deadline: null } : current;
}
export function endTimer(timer: RoundTimer, now: number): RoundTimer {
  const current = advanceTimer(timer, now);
  return timerFinished(current, now) ? current : { ...current, status: 'ended', remainingMs: timerRemaining(current, now), deadline: null };
}
export function isRoundTimer(value: unknown): value is RoundTimer {
  const t = value as RoundTimer;
  return !!t && timerDurations.includes(t.duration) && ['ready', 'running', 'paused', 'expired', 'ended'].includes(t.status) &&
    Number.isFinite(t.remainingMs) && t.remainingMs >= 0 && t.remainingMs <= t.duration * 1000 &&
    (t.status === 'running' ? Number.isSafeInteger(t.deadline) && t.deadline! > 0 && t.deadline! <= 8640000000000000 : t.deadline === null) &&
    (t.status !== 'ready' || t.remainingMs === t.duration * 1000) && (t.status !== 'expired' || t.remainingMs === 0) &&
    (!['running', 'paused'].includes(t.status) || t.remainingMs > 0);
}
export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
