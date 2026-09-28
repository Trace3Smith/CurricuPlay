import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import { useResources } from '../resources/useResources';
import { useLessons } from './useLessons';
import LessonEditor from './LessonEditor';
import LessonUses, { ScheduleLesson } from './LessonUses';
import TeachingMemory from './TeachingMemory';

export default function Plan() {
  const state = useLessons(); const resources = useResources(); const { data: foundation } = useFoundation();
  const { lessonId } = useParams(); const location = useLocation(); const [query] = useSearchParams();
  const [filter, setFilter] = useState('all'); const [search, setSearch] = useState('');
  const creating = location.pathname === '/plan/new'; const revising = location.pathname.endsWith('/revise');
  const library = state.data; const lesson = library?.lessons.find(l => l.id === lessonId);
  const versions = library?.versions.filter(v => v.lessonId === lessonId) ?? [];
  const version = query.get('version') ? versions.find(v => v.id === query.get('version')) : versions[0];
  const copy = query.get('copy') ? library?.versions.find(v => v.id === query.get('copy')) : undefined;
  const selected = revising ? version : copy;
  const curriculum = resources.data?.curriculum.find(c => c.id === version?.curriculumVersionId);
  const source = resources.data?.sourceVersions.find(s => s.id === curriculum?.sourceVersionId);
  const sourceResource = resources.data?.sources.find(s => s.id === source?.sourceId);
  return <>
    <div className="ct-inline-actions ct-lesson-toolbar"><Link to="/plan">All lessons</Link><button className="ct-quiet" disabled={state.busy} onClick={() => { void state.retry(); resources.retry(); }}>Reload lessons</button></div>
    {state.error && !state.feedbackTarget && <p role="alert" className="ct-alert">{state.error}</p>}{resources.error && <p role="alert" className="ct-alert">{resources.error}</p>}{state.notice && !state.feedbackTarget && <p role="status" className="ct-notice">{state.notice}</p>}
    {!library || !resources.data ? <p role="status">{state.error || resources.error ? 'Reload lessons to try again.' : 'Opening your lesson library…'}</p> : creating || revising ?
      ((query.get('copy') && !copy) || (revising && !version) ? <p>That source lesson is unavailable.</p> : <LessonEditor key={`${location.pathname}-${location.search}-${state.generation}`} state={state} resources={resources.data} source={selected} revise={revising} />)
      : lessonId ? !lesson || !version ? <p>This lesson or version is unavailable in your workspace.</p> : <>
        <div className="ct-page-heading"><div><span className="ct-eyebrow">YOUR REUSABLE LESSON</span><h1>{version.title}</h1><p className="ct-lede">Version {version.number} · {version.readiness === 'ready' ? 'Ready — reviewed by you' : 'Draft — still preparing'} · {version.assignmentSnapshot.title}</p></div>
          <div className="ct-inline-actions"><Link className="ct-button" to={`/plan/${lesson.id}/revise?version=${version.id}`}>Revise lesson</Link><Link className="ct-button ct-secondary" to={`/plan/new?copy=${version.id}`}>Make a reusable copy</Link></div></div>
        <section className="ct-panel"><div className="ct-section-heading"><h2>Version history</h2><span className="ct-small">Every save is preserved</span></div><div className="ct-version-list">{versions.map(v => <Link aria-current={v.id === version.id ? 'page' : undefined} className={v.id === version.id ? 'ct-current-version' : ''} key={v.id} to={`/plan/${lesson.id}?version=${v.id}`}>Version {v.number} · {v.readiness} · {v.createdAt.slice(0, 10)}</Link>)}</div>
          <p className="ct-small">Originally created for {foundation!.assignments.find(a => a.id === lesson.originalAssignmentId)?.title}. Saved version context: {version.assignmentSnapshot.title} · {version.assignmentSnapshot.subject}.</p>
          {version.sourceVersionId && <p className="ct-small">Based on <Link to={`/plan/${library.versions.find(v => v.id === version.sourceVersionId)?.lessonId}?version=${version.sourceVersionId}`}>an earlier saved version</Link>.</p>}
        </section>
        <section className="ct-panel"><h2>Saved curriculum & Resources</h2>
          <p>{curriculum ? <Link to={`/resources/${sourceResource?.resourceId}/review/${curriculum.id}`}>{curriculum.label} · exact saved curriculum & source →</Link> : 'No curriculum was attached to this version.'}</p>
          <p className="ct-small">{version.curriculumMode === 'retain' ? 'Retained from its source lesson' : `Active when saved on ${version.curriculumAsOf}`} · {version.curriculumNodeIds.length} source rows selected. Standards alignment is not independently verified.</p>
          {version.curriculumNodeIds.length > 0 && <p className="ct-small">Source row references: {version.curriculumNodeIds.join(', ')}</p>}
          {version.standardReferences.length > 0 && <p className="ct-preserve-lines">Teacher-entered standards references (unverified):{'\n'}{version.standardReferences.join('\n')}</p>}
          <ul className="ct-record-list">{library.resourceLinks.filter(l => l.lessonVersionId === version.id).map(link => {
            const r = resources.data!.versions.find(v => v.id === link.resourceVersionId);
            return <li key={link.resourceVersionId}><div><Link to={`/resources/${r?.resourceId}`}>{r?.metadata.title} · Original {r?.number}</Link><p>{r?.fileName ?? 'Saved HTTPS bookmark · remote contents may change'}</p></div>{r?.kind === 'file' ? <a href={`/api/resources/${r.resourceId}/versions/${r.id}/download`}>Download saved original</a> : r && <a href={r.externalUrl!} target="_blank" rel="noreferrer">Open saved link ↗</a>}</li>;
          })}</ul>
          {!library.resourceLinks.some(l => l.lessonVersionId === version.id) && <p className="ct-small">No Resources attached.</p>}
        </section>
        <section className="ct-panel"><h2>Lesson plan</h2>{!version.sections.length ? <p>No lesson sections written yet.</p> : version.sections.map(s => <article key={s.kind} className="ct-lesson-section"><h3>{s.label}{s.audience === 'teacher' ? ' · Teacher only' : ''}</h3><p className="ct-preserve-lines">{s.content}</p></article>)}</section>
        <TeachingMemory library={library} lessonId={lesson.id} />
        <ScheduleLesson key={`${version.id}-${state.generation}`} state={state} version={version} />
        <LessonUses key={state.generation} state={state} lessonId={lesson.id} />
      </> : <>
        <div className="ct-page-heading"><div><span className="ct-eyebrow">PLAN · TEACH · REFLECT · REUSE</span><h1>Your lessons</h1><p className="ct-lede">A place for your plans and what you learn from teaching them.</p></div><Link to="/plan/new" className="ct-button">Create a lesson</Link></div>
        <section className="ct-panel"><div className="ct-resource-filters"><label>Search lessons<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Lesson title" /></label><label>Filter lesson assignment<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All assignments</option>{foundation!.assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div>
          {!library.lessons.length ? <div className="ct-empty"><h2>No lessons yet</h2><p>Create a lesson using your curriculum context and private Resources. Your content starts with you.</p></div> : <ul className="ct-resource-list">{library.lessons.flatMap(l => {
            const latest = library.versions.find(v => v.lessonId === l.id)!;
            if ((filter !== 'all' && !library.versions.some(v => v.lessonId === l.id && v.assignmentId === filter)) || !latest.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) return [];
            const taught = library.teachingRecords.filter(t => library.occurrences.some(o => o.id === t.occurrenceId && library.versions.some(v => v.id === o.lessonVersionId && v.lessonId === l.id))).length;
            return [<li key={l.id}><div><h2><Link to={`/plan/${l.id}`}>{latest.title}</Link></h2><p>{latest.assignmentSnapshot.title} · Version {latest.number} · {latest.readiness === 'ready' ? 'Ready' : 'Draft'}</p><p>{taught} taught {taught === 1 ? 'use' : 'uses'}{l.copiedFromVersionId ? ' · Reusable copy with linked history' : ''}</p></div><Link to={`/plan/${l.id}`}>Open lesson →</Link></li>];
          })}</ul>}
        </section>
      </>}
  </>;
}
