/** Display names for shared reports. Unlisted game types still show their stored ID. */
const names: Record<string, string> = { 'four-corners': 'Four Corners', 'state-lingo-bingo': 'State Lingo Bingo' };
export const gameName = (gameType: string) => names[gameType] ?? gameType;
/** Report header prefix: "Grade 5 · ", "Kindergarten · ", or nothing for a record without a grade. */
export const gradeLabel = (grade?: string) => !grade ? '' : grade === 'K' ? 'Kindergarten · ' : `Grade ${grade} · `;
/** "10 squats ×2, Jog 2 laps": each label once, in first-done order, with a count when repeated. */
export function tally(labels: readonly string[]): string {
  const counts = new Map<string, number>();
  labels.forEach(l => counts.set(l, (counts.get(l) ?? 0) + 1));
  return [...counts].map(([label, n]) => n > 1 ? `${label} ×${n}` : label).join(', ');
}
