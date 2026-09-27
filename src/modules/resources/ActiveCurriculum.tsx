import { Link } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import { activeBinding } from '../../../shared/contracts/resources';
import { useResources } from './useResources';

export default function ActiveCurriculum() {
  const { data: foundation } = useFoundation(); const state = useResources();
  const assignmentId = foundation?.profile.selectedAssignmentId;
  if (!assignmentId) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: foundation!.profile.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const binding = activeBinding(state.data?.bindings ?? [], assignmentId, today);
  const next = state.data?.bindings.filter(b => b.assignmentId === assignmentId && b.effectiveFrom > today).sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const curriculum = state.data?.curriculum.find(c => c.id === binding?.curriculumVersionId);
  const sourceVersion = state.data?.sourceVersions.find(s => s.id === curriculum?.sourceVersionId);
  const source = state.data?.sources.find(s => s.id === sourceVersion?.sourceId);
  return <section className="ct-panel ct-active-curriculum"><span className="ct-eyebrow">ACTIVE CURRICULUM</span>
    {state.error ? <><p role="alert">Curriculum could not be loaded. Your teaching records and Games remain available.</p><button onClick={state.retry}>Retry curriculum</button></>
      : !state.data ? <p role="status">Loading curriculum…</p>
      : curriculum ? <><h2>{curriculum.label}</h2><p>{binding!.effectiveFrom} through {binding!.effectiveTo} · Teacher-reviewed source content</p><Link to={`/resources/${source?.resourceId}/review/${curriculum.id}`}>View curriculum & source →</Link></>
      : <><h2>No active curriculum for this assignment</h2><p>Add a source and approve its curriculum review to get started.</p><Link to="/resources">Open Resources →</Link></>}
    {next && <p className="ct-small">Scheduled next: {state.data?.curriculum.find(c => c.id === next.curriculumVersionId)?.label} · effective {next.effectiveFrom}</p>}
  </section>;
}
