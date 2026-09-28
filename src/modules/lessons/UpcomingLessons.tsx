import { Link } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import { teacherDate } from '../../../shared/contracts/lessons';
import { useLessons } from './useLessons';

export default function UpcomingLessons() {
  const { data } = useFoundation(); const state = useLessons();
  const assignmentId = data?.profile.selectedAssignmentId;
  if (!assignmentId) return null;
  const today = teacherDate(data!.profile.timezone);
  const planned = state.data?.occurrences.filter(o => o.assignmentId === assignmentId && !state.data!.teachingRecords.some(t => t.occurrenceId === o.id)) ?? [];
  const upcoming = planned.filter(o => o.scheduledOn >= today).slice(0, 3);
  const past = planned.filter(o => o.scheduledOn < today).length;
  return <section className="ct-panel"><span className="ct-eyebrow">YOUR NEXT LESSONS</span><h2>Planned lessons</h2>
    {state.error ? <><p role="alert">{state.error}</p><button onClick={() => void state.retry()}>Retry lessons</button></> : !state.data ? <p role="status">Loading planned lessons…</p> : !upcoming.length ? <p>No upcoming lesson scheduled for this assignment. <Link to="/plan">Plan a lesson →</Link></p> : <ul className="ct-record-list">{upcoming.map(o => {
      const v = state.data!.versions.find(v => v.id === o.lessonVersionId)!;
      return <li key={o.id}><div><h3><Link to={`/plan/${v.lessonId}?version=${v.id}#use-${o.id}`}>{v.title}</Link></h3><p>{o.scheduledOn} · Planned · Version {v.number} · {v.readiness === 'ready' ? 'Ready — reviewed by you' : 'Draft — still preparing'}</p></div><Link to={`/plan/${v.lessonId}?version=${v.id}#use-${o.id}`}>Open / mark taught →</Link></li>;
    })}</ul>}
    {past > 0 && <p className="ct-small">{past} past scheduled {past === 1 ? 'use has' : 'uses have'} not been marked taught. <Link to="/plan">Review in Plan →</Link></p>}
  </section>;
}
