import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useFoundation } from '../../app/FoundationProvider';
import { api } from '../../app/api';
import { hasLowRating, teacherDate, type LessonOccurrence, type LessonReflection, type LessonVersion, type ReflectionInput, type TeachingRecord } from '../../../shared/contracts/lessons';
import type { LessonState } from './useLessons';
import { LowRatingAcknowledgement, ReflectionText } from './TeachingMemory';

export function ScheduleLesson({ state, version }: { state: LessonState; version: LessonVersion }) {
  const { data } = useFoundation();
  const today = teacherDate(data!.profile.timezone);
  const [assignmentId, setAssignmentId] = useState(version.assignmentId);
  const [date, setDate] = useState(today); const [ack, setAck] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const assignment = data!.assignments.find(a => a.id === assignmentId);
  const low = hasLowRating(state.data!, version.lessonId);
  const alreadyScheduled = state.data!.occurrences.some(o => o.lessonVersionId === version.id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const saved = await state.run(() => api<{ id: string }>('/lessons/schedule', 'POST', { id: requestId, versionId: version.id, assignmentId, scheduledOn: date, acknowledgeLowRating: ack }), 'Lesson scheduled. It remains Planned until you mark it taught.');
    if (saved) { setRequestId(crypto.randomUUID()); setAck(false); }
  }
  return <section className="ct-panel"><h2>{alreadyScheduled ? 'Schedule another use' : 'Schedule this version'}</h2><p>Version {version.number} · {version.readiness === 'ready' ? 'Ready — reviewed by you' : 'Draft — still preparing'}</p>
    {alreadyScheduled && <p className="ct-small">This creates a separate planned use. Existing scheduled and taught uses remain in the history below.</p>}
    <form onSubmit={submit}><fieldset disabled={state.busy}><div className="ct-form"><label>Schedule Teaching Assignment<select value={assignmentId} onChange={e => setAssignmentId(e.target.value)}>{data!.assignments.map(a => <option value={a.id} key={a.id}>{a.title} · {data!.schoolYears.find(y => y.id === a.schoolYearId)?.name}</option>)}</select></label><label>Scheduled date<input type="date" required value={date} min={assignment?.startsOn} max={assignment?.endsOn} onChange={e => setDate(e.target.value)} /></label></div>
      {version.assignmentId !== assignmentId && <p className="ct-review-limits">This use is for {assignment?.title}. The saved version keeps its original {version.assignmentSnapshot.title} context and curriculum. Revise or copy it first if you need different curriculum references.</p>}
      {low && <LowRatingAcknowledgement checked={ack} onChange={setAck} />}
      <button className="ct-button" disabled={!assignmentId || (low && !ack)}>Schedule lesson</button>
    </fieldset></form>
  </section>;
}
function ReflectionForm({ state, record, reflection, onDone }: { state: LessonState; record: TeachingRecord; reflection?: LessonReflection; onDone: () => void }) {
  const [value, setValue] = useState<ReflectionInput>({ revision: reflection?.revision ?? null, rating: reflection?.rating ?? 3, worked: reflection?.worked ?? '', change: reflection?.change ?? '', reflection: reflection?.reflection ?? '', pacing: reflection?.pacing ?? '', materials: reflection?.materials ?? '', transitions: reflection?.transitions ?? '' });
  async function save(e: FormEvent) {
    e.preventDefault();
    const saved = await state.run(() => api<{ id: string }>(`/lessons/${record.id}/reflection`, 'POST', value), 'Reflection saved to this taught use and its exact lesson version.', record.id);
    if (saved) onDone();
  }
  return <form onSubmit={save}><fieldset disabled={state.busy}><legend>{reflection ? 'Edit reflection' : 'Record a reflection'}</legend><div className="ct-form">
    <label>Rating<select value={value.rating} onChange={e => setValue(v => ({ ...v, rating: Number(e.target.value) }))}>{[1, 2, 3, 4, 5].map(n => <option value={n} key={n}>{n} / 5{n <= 2 ? ' · review before reuse' : ''}</option>)}</select></label>
    {([['worked', 'What worked'], ['change', 'What should change'], ['reflection', 'General reflection'], ['pacing', 'Pacing notes'], ['materials', 'Materials notes'], ['transitions', 'Transition notes']] as const).map(([key, label]) => <label key={key}>{label}<textarea maxLength={4000} rows={2} value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>)}
    <div className="ct-inline-actions ct-span"><button className="ct-button">{state.busy && state.feedbackTarget === record.id ? 'Saving reflection…' : 'Save reflection'}</button><button type="button" onClick={onDone}>Cancel</button></div>
  </div></fieldset></form>;
}
function LessonUse({ state, occurrence, version, number }: { state: LessonState; occurrence: LessonOccurrence; version: LessonVersion; number: number }) {
  const { data } = useFoundation(); const today = teacherDate(data!.profile.timezone);
  const [taughtOn, setTaughtOn] = useState(occurrence.scheduledOn <= today ? occurrence.scheduledOn : today);
  const [editing, setEditing] = useState(false);
  const record = state.data!.teachingRecords.find(t => t.occurrenceId === occurrence.id);
  const reflection = state.data!.reflections.find(r => r.teachingRecordId === record?.id);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const showFeedback = !!record && state.feedbackTarget === record.id;
  useEffect(() => {
    if (showFeedback && (state.error || state.notice)) feedbackRef.current?.scrollIntoView({ block: 'nearest' });
  }, [showFeedback, state.error, state.notice]);
  const assignment = data!.assignments.find(a => a.id === occurrence.assignmentId);
  async function mark(e: FormEvent) {
    e.preventDefault();
    const saved = await state.run(() => api<{ id: string }>(`/lessons/${occurrence.id}/taught`, 'POST', { taughtOn }), 'Marked taught. You can now record a reflection.');
    if (saved) setEditing(true);
  }
  return <article id={`use-${occurrence.id}`} className="ct-lesson-use">
    <h3>{record ? 'Taught' : 'Planned'} · {record?.taughtOn ?? occurrence.scheduledOn} · Version {version.number}</h3><p>{occurrence.assignmentSnapshot.title} · {version.title}</p>
    <p className="ct-small">Use {number} · Scheduled for {occurrence.scheduledOn}{record ? ` · Taught on ${record.taughtOn}` : ' · Not yet marked taught'}</p>
    {record ? <><p className="ct-small">The original scheduled date is preserved. Reflection belongs to this taught use of Version {version.number}.</p>
      {reflection && !editing && <ReflectionText reflection={reflection} />}
      {editing ? <ReflectionForm key={`${record.id}-${reflection?.revision ?? 0}`} state={state} record={record} reflection={reflection} onDone={() => setEditing(false)} /> : <button onClick={() => setEditing(true)}>{reflection ? 'Edit reflection' : 'Add reflection'}</button>}
    </> : <form className="ct-mark-taught" onSubmit={mark}><label>Actually taught on<input type="date" required value={taughtOn} min={assignment?.startsOn} max={assignment && assignment.endsOn < today ? assignment.endsOn : today} onChange={e => setTaughtOn(e.target.value)} /></label><button disabled={state.busy} className="ct-button">Mark taught</button></form>}
    {showFeedback && <div ref={feedbackRef}>
      {state.error && <p role="alert" className="ct-alert">{state.error}</p>}
      {state.notice && <p role="status" className="ct-notice">{state.notice}</p>}
      {state.error && !editing && <button disabled={state.busy} onClick={() => void state.retry()}>Reload saved reflection</button>}
    </div>}
  </article>;
}
export default function LessonUses({ state, lessonId }: { state: LessonState; lessonId: string }) {
  const versions = state.data!.versions.filter(v => v.lessonId === lessonId);
  const occurrences = state.data!.occurrences.filter(o => versions.some(v => v.id === o.lessonVersionId));
  const createdOrder = [...occurrences].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const repeatedSchedule = occurrences.some((o, i) => occurrences.slice(i + 1).some(other => other.assignmentId === o.assignmentId && other.scheduledOn === o.scheduledOn));
  return <section className="ct-panel"><h2>Scheduled & taught uses</h2><p>Each use keeps the version and assignment chosen when scheduled.</p>
    {repeatedSchedule && <p className="ct-small">More than one use shares a date and assignment. These are separate scheduled uses. Marking one taught does not change another use.</p>}
    {!occurrences.length ? <p>No uses scheduled yet.</p> : occurrences.map(o => <LessonUse key={o.id} state={state} occurrence={o} version={versions.find(v => v.id === o.lessonVersionId)!} number={createdOrder.findIndex(item => item.id === o.id) + 1} />)}
  </section>;
}
