import { Link } from 'react-router-dom';
import { hasLowRating, teachingMemory, type LessonLibrary, type LessonReflection } from '../../../shared/contracts/lessons';

export function ReflectionText({ reflection: r }: { reflection: LessonReflection }) {
  return <div className="ct-reflection-text"><strong>Rating: {r.rating} / 5</strong>
    {([['What worked', r.worked], ['What should change', r.change], ['General reflection', r.reflection], ['Pacing', r.pacing], ['Materials', r.materials], ['Transitions', r.transitions]] as const)
      .filter(([, text]) => text).map(([label, text]) => <div key={label}><h3>{label}</h3><p className="ct-preserve-lines">{text}</p></div>)}
  </div>;
}
export function LowRatingAcknowledgement({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="ct-review-limits"><strong>A prior use was rated 1 or 2 out of 5.</strong><p>Review what worked and what should change in Teaching Memory before reusing this lesson. Your lesson will stay as written.</p>
    <label className="ct-checkbox"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} required />I reviewed the prior teaching notes and want to reuse this lesson.</label>
  </div>;
}
export default function TeachingMemory({ library, lessonId }: { library: LessonLibrary; lessonId: string }) {
  const memory = teachingMemory(library, lessonId);
  return <section className="ct-panel"><span className="ct-eyebrow">LEARN FROM EACH USE</span><h2>Teaching Memory</h2>
    {hasLowRating(library, lessonId) && <p className="ct-alert">A prior use was rated 1 or 2 out of 5. Review these notes before reuse.</p>}
    {!memory.length ? <p>No taught history yet. Schedule a use, then mark it taught to record a reflection.</p> : memory.map(m => <article className="ct-memory-entry" key={m.record.id}>
      <h3>{m.version.title} · Version {m.version.number}</h3><p>{m.record.taughtOn} · {m.occurrence.assignmentSnapshot.title}</p>
      <p className="ct-small">Scheduled for {m.occurrence.scheduledOn} · <Link to={`/plan/${m.version.lessonId}?version=${m.version.id}#use-${m.occurrence.id}`}>View this taught use</Link></p>
      {m.reflection ? <ReflectionText reflection={m.reflection} /> : <p className="ct-small">Taught · No reflection recorded.</p>}
    </article>)}
  </section>;
}
