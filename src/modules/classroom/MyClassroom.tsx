import { Link } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import WorkQueue from '../work/WorkQueue';

export default function MyClassroom() {
  const { data } = useFoundation();
  if (!data) return null;
  const assignment = data.assignments.find(assignment => assignment.id === data.profile.selectedAssignmentId);
  const year = data.schoolYears.find(year => year.id === data.profile.selectedSchoolYearId);
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: data.profile.timezone }).format(new Date());
  const ready = data.profile.displayName && year && assignment;
  return <>
    <div className="ct-page-heading"><div><div className="ct-eyebrow">{today}</div><h1>My Classroom</h1><p className="ct-lede">{data.profile.displayName ? `Welcome back, ${data.profile.displayName}.` : 'Welcome to your teaching workspace.'} A clear place to begin.</p></div><span className="ct-alpha">YOUR TEACHING, CONNECTED</span></div>
    {!ready && <section className="ct-onboarding"><div><span className="ct-eyebrow">MAKE YOURSELF AT HOME</span><h2>Set up your teaching context.</h2><p>{!data.profile.displayName ? 'Start with your teacher profile, then add a school year and Teaching Assignment.' : !year ? 'Establish a school year in Manage, then select it above.' : 'Create a Teaching Assignment in Manage, then select it above.'}</p></div><Link className="ct-button" to="/manage">Set up my classroom →</Link></section>}
    <div className="ct-overview">
      <section className="ct-teaching-card"><span className="ct-eyebrow">WHAT I’M TEACHING</span><h2>{assignment?.title ?? 'Your teaching context'}</h2><p>{assignment ? [assignment.subject, assignment.course].filter(Boolean).join(' · ') : 'Select an assignment to bring its work into focus.'}</p><div className="ct-chips">{year && <span>{year.name}</span>}{assignment?.grades.map(grade => <span key={grade}>{grade}</span>)}{assignment && !assignment.isActive && <span>Inactive assignment</span>}</div><Link to="/manage">Manage assignments ↗</Link></section>
      <section className="ct-panel ct-schedule"><span className="ct-eyebrow">WHERE I NEED TO BE</span><h2>Your schedule</h2><p className="ct-preserve-lines">{assignment?.schedule || 'No schedule recorded for this context yet.'}</p>{assignment?.school && <span className="ct-small">{assignment.school}</span>}<p className="ct-small">Assignment schedule notes · Calendar integration comes later.</p></section>
    </div>
    <WorkQueue />
    <div className="ct-bottom-row"><div><h2>Ready for a change of pace?</h2><p>Your classroom games are right where you need them.</p></div><Link className="ct-button ct-secondary" to="/games">Open Games →</Link></div>
  </>;
}
