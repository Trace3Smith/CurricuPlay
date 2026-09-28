import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import { api } from '../../app/api';
import { activeBinding, fieldLabels, type ResourceLibrary } from '../../../shared/contracts/resources';
import { hasLowRating, lessonSaveInput, lessonSectionGroups, teacherDate, type LessonSaveInput, type LessonVersion } from '../../../shared/contracts/lessons';
import type { LessonState } from './useLessons';
import TeachingMemory, { LowRatingAcknowledgement } from './TeachingMemory';

export default function LessonEditor({ state, resources, source, revise }: { state: LessonState; resources: ResourceLibrary; source?: LessonVersion; revise: boolean }) {
  const { data: foundation } = useFoundation(); const navigate = useNavigate();
  const [title, setTitle] = useState(source ? `${source.title}${revise ? '' : ' (copy)'}` : '');
  const [assignmentId, setAssignmentId] = useState(source?.assignmentId ?? foundation!.profile.selectedAssignmentId ?? foundation!.assignments[0]?.id ?? '');
  const [sections, setSections] = useState<LessonSaveInput['sections']>(source?.sections ?? []);
  const [standards, setStandards] = useState(source?.standardReferences.join('\n') ?? '');
  const [mode, setMode] = useState<'active' | 'retain'>(source ? 'retain' : 'active');
  const [nodeIds, setNodeIds] = useState(source?.curriculumNodeIds ?? []);
  const [resourceIds, setResourceIds] = useState(state.data!.resourceLinks.filter(l => l.lessonVersionId === source?.id).map(l => l.resourceVersionId));
  const [readiness, setReadiness] = useState<'draft' | 'ready'>('draft');
  const [ack, setAck] = useState(false); const [error, setError] = useState('');
  const [curriculumDetail, setCurriculumDetail] = useState<ResourceLibrary | null>(null); const [curriculumError, setCurriculumError] = useState('');
  const currentBinding = activeBinding(resources.bindings, assignmentId, teacherDate(foundation!.profile.timezone));
  const curriculumId = mode === 'retain' ? source?.curriculumVersionId ?? null : currentBinding?.curriculumVersionId ?? null;
  const bindingId = mode === 'retain' ? source?.curriculumBindingId ?? null : currentBinding?.id ?? null;
  const curriculum = resources.curriculum.find(c => c.id === curriculumId);
  const sourceVersion = resources.sourceVersions.find(s => s.id === curriculum?.sourceVersionId);
  const resourceId = resources.sources.find(s => s.id === sourceVersion?.sourceId)?.resourceId;
  const low = revise && !!source && hasLowRating(state.data!, source.lessonId);
  useEffect(() => {
    const abort = new AbortController(); setCurriculumDetail(null); setCurriculumError('');
    if (resourceId) void api<ResourceLibrary>(`/resources/${resourceId}`, 'GET', undefined, abort.signal)
      .then(value => { if (!abort.signal.aborted) setCurriculumDetail(value); })
      .catch(e => { if (!abort.signal.aborted) setCurriculumError(e.message); });
    return () => abort.abort();
  }, [resourceId]);
  const proposal = curriculumDetail?.curriculum.find(c => c.id === curriculumId)?.proposal;
  const review = curriculumDetail?.reviews.find(r => r.curriculumVersionId === curriculumId);
  function changeSection(kind: string, label: string, content: string, teacher: boolean) {
    setSections(items => {
      const existing = items.find(s => s.kind === kind);
      if (!content.trim()) return items.filter(s => s.kind !== kind);
      const section = { kind, label, content, audience: teacher ? 'teacher' as const : 'instruction' as const };
      return existing ? items.map(s => s.kind === kind ? section : s) : [...items, section];
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    const knownOrder: string[] = lessonSectionGroups.flatMap(g => g.fields.map(([kind]) => kind));
    const ordered = [...sections].sort((a, b) => (knownOrder.includes(a.kind) ? knownOrder.indexOf(a.kind) : 100) - (knownOrder.includes(b.kind) ? knownOrder.indexOf(b.kind) : 100));
    const parsed = lessonSaveInput.safeParse({ title, assignmentId, sections: ordered, standardReferences: standards.split('\n').map(s => s.trim()).filter(Boolean), readiness,
      curriculumMode: mode, curriculumVersionId: curriculumId, curriculumBindingId: bindingId, curriculumNodeIds: nodeIds, resourceVersionIds: resourceIds,
      sourceVersionId: source?.id ?? null, revision: revise ? state.data!.lessons.find(l => l.id === source?.lessonId)!.revision : null, acknowledgeLowRating: ack });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const saved = await state.run(() => api<{ lessonId: string; versionId: string }>(revise ? `/lessons/${source!.lessonId}/versions` : '/lessons', 'POST', parsed.data), 'Lesson saved. Previous versions and teaching history are preserved.');
    if (saved) navigate(`/plan/${saved.lessonId}?version=${saved.versionId}`);
  }
  return <>
    <div className="ct-page-heading"><div><span className="ct-eyebrow">PLAN WITH YOUR TEACHING CONTEXT</span><h1>{revise ? 'Revise lesson' : source ? 'Copy lesson' : 'Create a lesson'}</h1><p className="ct-lede">Write the sections that help you teach. Every save keeps a separate version; all sections are optional.</p></div></div>
    {revise && source && <TeachingMemory library={state.data!} lessonId={source.lessonId} />}
    <form onSubmit={save} className="ct-lesson-editor">
      <fieldset disabled={state.busy} className="ct-panel"><legend>Lesson details</legend>
        {error && <p role="alert" className="ct-alert">{error}</p>}
        <div className="ct-form"><label>Lesson title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required /></label>
          <label>Lesson Teaching Assignment<select value={assignmentId} onChange={e => { setAssignmentId(e.target.value); setMode('active'); setNodeIds([]); }} required><option value="">Choose an assignment</option>{foundation!.assignments.map(a => <option value={a.id} key={a.id}>{a.title} · {foundation!.schoolYears.find(y => y.id === a.schoolYearId)?.name}</option>)}</select></label>
        </div>
        {!foundation!.assignments.length && <p>Create a Teaching Assignment in <Link to="/manage">Manage</Link> first.</p>}
        {source && <p className="ct-small">Based on <Link to={`/plan/${source.lessonId}?version=${source.id}`}>{source.title} · Version {source.number}</Link>. Its original context and teaching history stay intact.</p>}
      </fieldset>
      <fieldset disabled={state.busy} className="ct-panel"><legend>Curriculum context</legend>
        {source && source.assignmentId === assignmentId && <label>Curriculum for this revision<select value={mode} onChange={e => { setMode(e.target.value as typeof mode); setNodeIds([]); }}><option value="retain">Keep the source lesson’s curriculum reference</option><option value="active">Use the currently active curriculum</option></select></label>}
        <h2>{curriculum?.label ?? 'No curriculum attached'}</h2>
        <p>{curriculum ? `${mode === 'active' ? 'Active now' : 'Retained from the source lesson'} · ${curriculum.effectiveFrom} through ${curriculum.effectiveTo}` : 'No active curriculum for this context. You can save a teacher-authored lesson without it.'}</p>
        <p className="ct-small">References preserve the exact reviewed source. They do not verify standards alignment. Lesson content is written by you.</p>
        {resourceId && <Link to={`/resources/${resourceId}/review/${curriculumId}`} target="_blank" rel="noreferrer">View curriculum & source ↗</Link>}
        {curriculumError && <p role="alert">{curriculumError} Reopen the editor to retry.</p>}
        {resourceId && !proposal && !curriculumError && <p role="status">Loading reviewed curriculum…</p>}
        {proposal && <details className="ct-lesson-nodes"><summary>Choose curriculum topics / source rows (optional)</summary>{proposal.nodes.filter(n => n.assertions.some(a => review?.decisions[a.id] === 'accept')).map(node => <div key={node.id} className="ct-curriculum-choice">
          <label className="ct-checkbox"><input type="checkbox" checked={nodeIds.includes(node.id)} onChange={e => setNodeIds(ids => e.target.checked ? [...ids, node.id] : ids.filter(id => id !== node.id))} />Source row {node.row}</label>
          {node.assertions.filter(a => review?.decisions[a.id] === 'accept').map(a => <p className="ct-small" key={a.id}><strong>{fieldLabels[a.field]}:</strong> {a.text} <span>({a.citation.sheet}!{a.citation.cell})</span>{a.uncertainty.length > 0 && <span> · Source uncertainty: {a.uncertainty.join(' ')}</span>}</p>)}
        </div>)}</details>}
        <label className="ct-review-note">Standards references (teacher-entered, unverified)<textarea rows={2} value={standards} onChange={e => setStandards(e.target.value)} placeholder="Optional · one reference per line" /></label>
      </fieldset>
      <fieldset disabled={state.busy} className="ct-panel"><legend>Attached Resources</legend><p className="ct-small">Choose exact originals from your private library. Later resource edits will not replace these attachments. Link originals preserve the URL, not the remote page contents.</p>
        {!resources.resources.length ? <p>No resources yet. <Link to="/resources" target="_blank" rel="noreferrer">Add a Resource ↗</Link>, then reopen this editor.</p> : <div className="ct-resource-attachments">{resources.resources.map(r => <label key={r.id}>{r.metadata.title}<select value={resourceIds.find(id => resources.versions.some(v => v.id === id && v.resourceId === r.id)) ?? ''} onChange={e => setResourceIds(ids => [...ids.filter(id => !resources.versions.some(v => v.id === id && v.resourceId === r.id)), ...(e.target.value ? [e.target.value] : [])])}><option value="">Not attached</option>{resources.versions.filter(v => v.resourceId === r.id).map(v => <option key={v.id} value={v.id}>Original {v.number} · {v.metadata.title} · {v.fileName ?? 'HTTPS bookmark'}</option>)}</select></label>)}</div>}
      </fieldset>
      {lessonSectionGroups.map((group, index) => <details className="ct-panel ct-section-editor" key={group.label} open={index === 0 || undefined}><summary>{group.label} <span className="ct-small">{group.fields.filter(([kind]) => sections.some(s => s.kind === kind)).length} filled</span></summary><div className="ct-form">{group.fields.map(([kind, label]) => <label key={kind}>{label}<textarea rows={3} maxLength={8000} value={sections.find(s => s.kind === kind)?.content ?? ''} disabled={state.busy} onChange={e => changeSection(kind, label, e.target.value, group.label === 'Teacher-only notes')} /></label>)}</div></details>)}
      <fieldset disabled={state.busy} className="ct-panel"><legend>Save this version</legend><label>Lesson readiness<select value={readiness} onChange={e => setReadiness(e.target.value as typeof readiness)}><option value="draft">Draft · still preparing</option><option value="ready">Ready · reviewed by me</option></select></label><p className="ct-small">Readiness is your own judgment. Saving or scheduling does not mark a lesson taught.</p>
        {low && <LowRatingAcknowledgement checked={ack} onChange={setAck} />}
        <div className="ct-inline-actions"><button className="ct-button" disabled={!assignmentId || (low && !ack)}>{state.busy ? 'Saving…' : 'Save lesson version'}</button><Link to={source && revise ? `/plan/${source.lessonId}` : '/plan'}>Cancel</Link></div>
      </fieldset>
    </form>
  </>;
}
