import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../app/api';
import { useFoundation } from '../../app/FoundationProvider';
import { useResources } from './useResources';
import ResourceForm, { OriginalFields, readOriginal } from './ResourceForm';
import { Feedback } from './Resources';
import CurriculumImport from './CurriculumImport';
import CurriculumReview from './CurriculumReview';

export default function ResourceDetail() {
  const { resourceId, curriculumId } = useParams(); const state = useResources(resourceId); const { data: foundation } = useFoundation();
  const [editing, setEditing] = useState(false); const [addingVersion, setAddingVersion] = useState(false); const [importing, setImporting] = useState(false);
  useEffect(() => { setEditing(false); setAddingVersion(false); setImporting(false); window.scrollTo(0, 0); }, [resourceId, curriculumId]);
  const data = state.data; const resource = data?.resources[0];
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget;
    const result = await state.run(async () => { const original = await readOriginal(form); return api<{ id: string }>(`/resources/${resourceId}/versions`, 'POST', { revision: resource!.revision, original }); }, 'New original saved. Existing curriculum and assignment bindings still refer to their prior originals.');
    if (result) setAddingVersion(false);
  }
  const curriculum = data?.curriculum.find(c => c.id === curriculumId);
  const review = data?.reviews.find(r => r.curriculumVersionId === curriculumId);
  return <>
    <Link to="/resources">← All resources</Link><Feedback state={state} />
    {!resource && !state.error && <p role="status">Loading resource…</p>}
    {resource && data && <>
      <div className="ct-page-heading"><div><span className="ct-eyebrow">PRIVATE PERSONAL RESOURCE</span><h1>{resource.metadata.title}</h1><p className="ct-lede">{resource.metadata.description || 'Your original material and its reviewed curriculum stay together here.'}</p></div><button onClick={() => setEditing(!editing)}>Edit details</button></div>
      {curriculum && review && <CurriculumReview key={`${curriculum.id}-${review.revision}`} resourceId={resourceId!} version={curriculum} review={review} data={data} state={state} />}
      {editing && <section className="ct-panel"><h2>Resource details</h2><ResourceForm key={resource.revision} initial={resource.metadata} busy={state.busy} cancel={() => setEditing(false)} submit={async metadata => { const result = await state.run(() => api<{ id: string }>(`/resources/${resourceId}`, 'PATCH', { revision: resource.revision, metadata }), 'Resource details saved.'); if (result) setEditing(false); }} /></section>}
      <section className="ct-panel"><h2>Source & context</h2><p>{resource.metadata.sourceName} · {resource.metadata.origin} · {resource.metadata.type.replaceAll('_',' ')}</p><p>{[resource.metadata.subject, resource.metadata.course, resource.metadata.grades.join(', ')].filter(Boolean).join(' · ') || 'No instructional context labels yet.'}</p><p className="ct-small">Linked assignments: {resource.metadata.assignmentIds.map(id => foundation?.assignments.find(a => a.id === id)?.title).filter(Boolean).join(', ') || 'None'}<br />Tags: {resource.metadata.tags.join(', ') || 'None'} · Standards labels (unverified): {resource.metadata.standards.join(', ') || 'None'}</p><p className="ct-small">Created {resource.createdAt.slice(0,10)} · Updated {resource.updatedAt.slice(0,10)}. Referencing a district or school grants it no access.</p></section>
      <section className="ct-panel"><div className="ct-section-heading"><h2>Originals</h2><button onClick={() => setAddingVersion(!addingVersion)}>Add new original</button></div><p>Each upload stays unchanged. Adding a new original does not activate it or alter an existing curriculum review.</p>
        {addingVersion && <form className="ct-form" onSubmit={upload}><OriginalFields /><div className="ct-form-actions ct-span"><button className="ct-button" disabled={state.busy}>Save new original</button><button type="button" disabled={state.busy} onClick={() => setAddingVersion(false)}>Cancel</button></div></form>}
        <ul className="ct-resource-list">{data.versions.map((v,index) => <li key={v.id}><div><strong>Original {v.number}{index === 0 ? ' · Current' : ' · Historical'}</strong><p>{v.fileName ?? 'External bookmark'} · {v.createdAt.slice(0,10)}{v.byteSize ? ` · ${(v.byteSize/1024).toFixed(1)} KiB` : ''}</p><details><summary>Integrity & provenance</summary><p className="ct-small">Source at upload: {v.metadata.sourceName} · {v.metadata.origin} · {v.metadata.title}</p><p className="ct-hash">SHA-256: {v.sha256}</p><p className="ct-small">{v.kind === 'file' ? 'Original bytes preserved in private storage. Extraction cites this exact original.' : 'The URL is preserved, but the remote page can change. Its contents have not been captured.'}</p></details></div>{v.kind === 'file' ? <a href={`/api/resources/${resourceId}/versions/${v.id}/download`}>Download original</a> : <a href={v.externalUrl!} target="_blank" rel="noopener noreferrer">Open source ↗</a>}</li>)}</ul>
      </section>
      <section className="ct-panel"><div className="ct-section-heading"><h2>Curriculum reviews</h2><button className="ct-button" onClick={() => setImporting(!importing)}>Prepare curriculum review</button></div>
        {!data.curriculum.length && <p>No curriculum has been extracted from this resource yet.</p>}
        <ul className="ct-resource-list">{data.curriculum.map(c => { const r = data.reviews.find(r => r.curriculumVersionId === c.id); return <li key={c.id}><div><Link to={`/resources/${resourceId}/review/${c.id}`}>{c.label}</Link><p>{r?.approvedAt ? 'Approved review' : 'Review pending'} · {c.effectiveFrom} through {c.effectiveTo}{c.supersedesId && ` · Revises ${data.curriculum.find(v => v.id === c.supersedesId)?.label ?? 'a prior version'}`}</p></div><Link to={`/resources/${resourceId}/review/${c.id}`}>Open review →</Link></li>; })}</ul>
      </section>
      {importing && <CurriculumImport key={data.versions[0]?.id} resourceId={resourceId!} state={state} data={data} />}
      {curriculumId && !curriculum && <p className="ct-alert" role="alert">That curriculum review is unavailable for this resource.</p>}
      {data.bindings.some(b => data.curriculum.some(c => c.id === b.curriculumVersionId)) && <section className="ct-panel"><h2>Assignment activation history</h2><p>Later activations take over on their effective dates. These original records stay unchanged.</p><ul className="ct-resource-list">{data.bindings.filter(b => data.curriculum.some(c => c.id === b.curriculumVersionId)).map(b => <li key={b.id}><div><strong>{foundation?.assignments.find(a => a.id === b.assignmentId)?.title}</strong><p>{data.curriculum.find(c => c.id === b.curriculumVersionId)?.label} · {b.effectiveFrom} through {b.effectiveTo}{b.previousBindingId ? ' · Replaces an earlier activation' : ''}</p></div></li>)}</ul></section>}
    </>}
  </>;
}
