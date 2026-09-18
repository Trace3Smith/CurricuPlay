import type { AssessmentTeam, GameSession } from '../../assessment/engine';

const colors = [
  { name: 'Orange', accent: '#fb923c' },
  { name: 'Purple', accent: '#c084fc' },
  { name: 'Green', accent: '#4ade80' },
  { name: 'Yellow', accent: '#facc15' },
  { name: 'Red', accent: '#f87171' },
  { name: 'Blue', accent: '#60a5fa' },
];
export function createCornerTeams(count: number): AssessmentTeam[] {
  return Array.from({ length: count }, (_, i) => ({ id: `team-${i + 1}`, ...(count === 6 ? colors[i] : { name: `Team ${i + 1}` }) }));
}
/** Display old default names consistently without rewriting historical responses or IDs. */
export function presentCornerSession(session: GameSession): GameSession {
  if (session.gameType !== 'four-corners' || session.mode !== 'team' || session.teams.length !== 6) return session;
  const defaults = createCornerTeams(6);
  return { ...session, teams: session.teams.map(team => {
    const preset = defaults.find(t => t.id === team.id);
    return preset && (team.name === `Team ${defaults.indexOf(preset) + 1}` || team.name === preset.name) ? { ...team, name: preset.name, accent: preset.accent } : team;
  }) };
}
