import type { AssessmentTeam } from './engine';
/** Color supplements the written name and never replaces it. */
export default function TeamName({ team }: { team: AssessmentTeam }) {
  return <span className="assessment-team-name">{team.accent && <i className="assessment-team-accent" style={{ backgroundColor: team.accent }} aria-hidden="true" />}{team.name}</span>;
}
