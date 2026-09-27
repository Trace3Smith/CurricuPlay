import { useState, type FormEvent } from 'react';
import { api } from '../../app/api';
import { useFoundation } from '../../app/FoundationProvider';
import { fieldLabels, type CurriculumReview as Review, type CurriculumVersion, type ResourceLibrary, type ReviewInput } from '../../../shared/contracts/resources';
import type { ResourceState } from './useResources';

export default function CurriculumReview({ resourceId, version, review, data, state }: { resourceId: string; version: CurriculumVersion; review: Review; data: ResourceLibrary; state: ResourceState }) {
  const { data: foundation } = useFoundation();
  const [decisions, setDecisions] = useState<ReviewInput['decisions']>(review.decisions); const [note, setNote] = useState(review.note); const [acknowledged, setAcknowledged] = useState(review.acknowledgeLimitations);
  const [page, setPage] = useState(0); const [assignmentId, setAssignmentId] = useState(foundation?.profile.selectedAssignmentId ?? '');
  const assertions = version.proposal.nodes.flatMap(n => n.assertions); const accepted = assertions.filter(a => decisions[a.id] === 'accept').length;
  const pending = assertions.filter(a => !decisions[a.id]).length;
  const source = data.sourceVersions.find(s => s.id === version.sourceVersionId)!;
  const original = data.versions.find(v => v.id === source.resourceVersionId)!;
  const locked = !!review.approvedAt;
  const previous = data.bindings.filter(b => b.assignmentId === assignmentId).sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const binding = data.bindings.find(b => b.assignmentId === assignmentId && b.curriculumVersionId === version.id);
  async function save(approve: boolean) {
    await state.run(() => api(`/resources/${resourceId}/curriculum/${version.id}/review`, 'POST', { revision: review.revision, decisions, note, acknowledgeLimitations: acknowledged, approve }), approve ? 'Review approved. Choose an assignment to activate this exact version.' : 'Review progress saved.');
  }
  async function activate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await state.run(() => api(`/resources/${resourceId}/curriculum/${version.id}/activate`, 'POST', { assignmentId, expectedBindingId: previous?.id ?? null }), 'Curriculum activation saved for this assignment. Historical bindings remain unchanged.');
  }
  return <section className="ct-panel ct-curriculum-review">
    <span className="ct-eyebrow">{locked ? 'APPROVED TEACHER REVIEW' : 'TEACHER REVIEW REQUIRED'}</span><h2>{version.label}</h2>
    <p>{version.effectiveFrom} through {version.effectiveTo} · Original {original.number} · {source.mapping.sheet} · {source.purposes.map(p => p.replaceAll('_',' ')).join(', ')}</p>
    <p className="ct-small">Source at upload: {original.metadata.sourceName} · {original.metadata.origin}. <a href={`/api/resources/${resourceId}/versions/${original.id}/download`}>Download this exact original</a> · Extraction: {version.proposal.adapter}. Literal confidence means exact copied text, not confirmed meaning or verified alignment.</p>
    <div className="ct-review-limits"><h3>Missing information & limits</h3><p>{version.proposal.missing.length ? `Not extracted: ${version.proposal.missing.map(f => fieldLabels[f]).join(', ')}.` : 'All mapped field categories contain some text; completeness is not implied.'}</p><ul>{version.proposal.warnings.map(w => <li key={w}>{w}</li>)}</ul>
      <h3>Conflicts</h3>{version.proposal.conflicts.length ? <ul>{version.proposal.conflicts.map(c => <li key={c.id}>{c.message}</li>)}</ul> : <p>No differing same-row values were detected in the selected mappings. Other conflicts may exist; record any you identify below.</p>}
    </div>
    <p role="status">{accepted} kept · {assertions.length - accepted - pending} excluded · {pending} awaiting a decision</p>
    {version.proposal.nodes.slice(page*15, (page+1)*15).map(node => <article className="ct-review-row" key={node.id}><h3>Source row {node.row}</h3>{node.assertions.map(a => <div className="ct-assertion" key={a.id}>
      <div><span className="ct-eyebrow">{fieldLabels[a.field]} · directly extracted</span><p className="ct-source-quote">{a.text}</p><p className="ct-small">{a.citation.sheet} · {a.citation.cell}{a.citation.url && <> · <a href={a.citation.url} target="_blank" rel="noopener noreferrer">Source cell link ↗</a></>}</p>
        {a.uncertainty.length>0 && <ul className="ct-uncertainty">{a.uncertainty.map(u => <li key={u}>Uncertain: {u}</li>)}</ul>}</div>
      <label>Decision for {a.citation.cell}<select disabled={locked || state.busy} value={decisions[a.id] ?? ''} onChange={e => setDecisions(current => { const next = { ...current }; if (e.target.value) next[a.id] = e.target.value as 'accept' | 'exclude'; else delete next[a.id]; return next; })}><option value="">Review…</option><option value="accept">Keep in reviewed curriculum</option><option value="exclude">Exclude from reviewed curriculum</option></select></label>
    </div>)}</article>)}
    {version.proposal.nodes.length>15 && <div className="ct-inline-actions"><button onClick={() => setPage(p => p-1)} disabled={!page}>Previous rows</button><span>Page {page+1} of {Math.ceil(version.proposal.nodes.length/15)}</span><button onClick={() => setPage(p => p+1)} disabled={(page+1)*15>=version.proposal.nodes.length}>Next rows</button></div>}
    <label className="ct-review-note">Review note<textarea value={note} onChange={e => setNote(e.target.value)} disabled={locked || state.busy} maxLength={4000} placeholder="Explain retained uncertainty, conflicts, and how this source should be used." /></label>
    <label className="ct-checkbox"><input type="checkbox" checked={acknowledged} disabled={locked || state.busy} onChange={e => setAcknowledged(e.target.checked)} />I reviewed the selected source text, missing information, conflicts, and extraction limits. Approval preserves the original provenance.</label>
    {!locked && <div className="ct-inline-actions"><button disabled={state.busy} onClick={() => void save(false)}>Save review progress</button><button className="ct-button" disabled={state.busy || pending>0 || !accepted || !acknowledged} onClick={() => void save(true)}>Approve curriculum review</button></div>}
    {locked && <div className="ct-activation"><h3>Use this reviewed curriculum</h3><p>This binds this exact version to an assignment. A later activation takes over on its effective date. Existing history is preserved.</p><form className="ct-form" onSubmit={activate}>
      <label>Activate for assignment<select required value={assignmentId} onChange={e => setAssignmentId(e.target.value)}><option value="">Choose assignment</option>{foundation?.assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <div className="ct-form-actions"><button className="ct-button" disabled={state.busy || !!binding || !assignmentId}>{binding ? 'Activation recorded' : 'Activate for assignment'}</button></div>
      {previous && <p className="ct-span ct-small">Latest activation starts {previous.effectiveFrom}. A replacement must begin later and fit within the assignment’s dates. Earlier bindings and work remain unchanged.</p>}
    </form></div>}
  </section>;
}
