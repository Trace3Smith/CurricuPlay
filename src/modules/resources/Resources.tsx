import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../app/api';
import { useFoundation } from '../../app/FoundationProvider';
import { resourceTypes } from '../../../shared/contracts/resources';
import { useResources, type ResourceState } from './useResources';
import ResourceForm from './ResourceForm';

export function Feedback({ state }: { state: ResourceState }) {
  return <>{state.error && <div className="ct-alert" role="alert">{state.error} <button type="button" onClick={state.retry}>Reload resources</button></div>}{state.notice && <p className="ct-notice" role="status">{state.notice}</p>}</>;
}
export default function Resources() {
  const state = useResources(); const { data: foundation } = useFoundation(); const navigate = useNavigate();
  const [adding, setAdding] = useState(false); const [search, setSearch] = useState(''); const [type, setType] = useState(''); const [assignment, setAssignment] = useState('');
  const resources = state.data?.resources.filter(r => (!type || r.metadata.type === type) && (!assignment || r.metadata.assignmentIds.includes(assignment)) && JSON.stringify(r.metadata).toLowerCase().includes(search.toLowerCase())) ?? [];
  return <>
    <div className="ct-page-heading"><div><span className="ct-eyebrow">YOUR PERSONAL TEACHING LIBRARY</span><h1>Resources</h1><p className="ct-lede">Keep the original. See what it supports. Review curriculum before using it.</p></div><button className="ct-button" onClick={() => setAdding(true)}>Add resource</button></div>
    <Feedback state={state} />
    {adding && <section className="ct-panel"><h2>Add to your library</h2><ResourceForm busy={state.busy} cancel={() => setAdding(false)} submit={async (metadata, original) => {
      const result = await state.run(() => api<{ id: string }>('/resources', 'POST', { metadata, original }), 'Resource saved.'); if (result) navigate(`/resources/${result.id}`);
    }} /></section>}
    <section className="ct-panel">
      <div className="ct-resource-filters"><label>Search resources<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, subject, grade, standard, tag…" /></label><label>Type<select value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{resourceTypes.map(t => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label><label>Assignment<select value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">All assignments</option>{foundation?.assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div>
      {!state.data && !state.error && <p role="status">Loading your resources…</p>}
      {state.data && !resources.length && <div className="ct-empty"><h2>{state.data.resources.length ? 'No matching resources' : 'Your library starts here'}</h2><p>Add a CSV or spreadsheet JSON snapshot for curriculum review, or save an external link.</p><p>Files remain private. Drive login permissions are not requested.</p></div>}
      <ul className="ct-resource-list">{resources.map(r => {
        const source = state.data!.sources.find(s => s.resourceId === r.id); const sourceVersions = state.data!.sourceVersions.filter(v => v.sourceId === source?.id);
        const curriculum = state.data!.curriculum.filter(c => sourceVersions.some(sv => sv.id === c.sourceVersionId));
        const approved = curriculum.some(c => state.data!.reviews.some(review => review.curriculumVersionId === c.id && review.approvedAt));
        const latest = state.data!.versions.filter(v => v.resourceId === r.id).sort((a,b) => b.number-a.number)[0];
        return <li key={r.id}><div><Link to={`/resources/${r.id}`}><h2>{r.metadata.title}</h2></Link><p>{[r.metadata.sourceName, r.metadata.subject, r.metadata.grades.join(', ')].filter(Boolean).join(' · ')}</p><div className="ct-chips"><span>{r.metadata.type.replaceAll('_',' ')}</span><span>Original {latest?.number ?? '—'}</span><span>{approved ? 'Reviewed curriculum' : source ? 'Curriculum review pending' : 'Resource'}</span><span>Private</span></div></div><Link to={`/resources/${r.id}`}>Open →</Link></li>;
      })}</ul>
    </section>
  </>;
}
