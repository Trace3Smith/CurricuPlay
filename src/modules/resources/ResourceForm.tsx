import { useState, type FormEvent } from 'react';
import { useFoundation } from '../../app/FoundationProvider';
import { MAX_SOURCE_BYTES, resourceTypes, type OriginalInput, type ResourceMetadata } from '../../../shared/contracts/resources';

export async function readOriginal(form: HTMLFormElement): Promise<OriginalInput> {
  const fields = new FormData(form);
  if (fields.get('originalKind') === 'link') return { kind: 'link', url: String(fields.get('url') ?? '') };
  const file = fields.get('file');
  if (!(file instanceof File) || !file.size || file.size > MAX_SOURCE_BYTES) throw new Error('Choose a nonempty CSV or spreadsheet JSON file up to 2 MiB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
  });
  return { kind: 'file', fileName: file.name, base64 };
}
export function OriginalFields() {
  const [kind, setKind] = useState('file');
  return <><label>Original source<select name="originalKind" value={kind} onChange={e => setKind(e.target.value)}><option value="file">Upload a table</option><option value="link">Save an external link</option></select></label>
    {kind === 'file' ? <label>Source file<input aria-label="Source file" name="file" type="file" accept=".csv,.json" required /><small>UTF-8 CSV or spreadsheet cell JSON · up to 2 MiB. PDF, Word, and Excel extraction comes later.</small></label>
      : <label>Source URL<input name="url" type="url" placeholder="https://…" required /><small>A private bookmark. ClassThread does not fetch this page or preserve the remote page’s contents.</small></label>}</>;
}
export default function ResourceForm({ initial, busy, submit, cancel }: { initial?: ResourceMetadata; busy: boolean; submit: (metadata: ResourceMetadata, original?: OriginalInput) => Promise<unknown>; cancel: () => void }) {
  const { data } = useFoundation(); const [error, setError] = useState(''); const [reading, setReading] = useState(false);
  if (!data) return null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setError(''); setReading(true);
    const f = new FormData(form); const text = (name: string) => String(f.get(name) ?? ''); const list = (name: string) => [...new Set(text(name).split(',').map(v => v.trim()).filter(Boolean))];
    try {
      const original = initial ? undefined : await readOriginal(form);
      await submit({ title: text('title'), description: text('description'), type: text('type') as ResourceMetadata['type'], origin: text('origin') as ResourceMetadata['origin'], sourceName: text('sourceName'), subject: text('subject'), course: text('course'), grades: list('grades'), standards: list('standards'), tags: list('tags'), schoolYearId: text('schoolYearId') || null, assignmentIds: f.getAll('assignmentIds').map(String) }, original);
    } catch (e) { setError((e as Error).message); } finally { setReading(false); }
  }
  return <form className="ct-form" onSubmit={save}>
    {error && <p className="ct-alert ct-span" role="alert">{error}</p>}
    <label>Title<input name="title" required maxLength={160} defaultValue={initial?.title} /></label>
    <label>Resource type<select name="type" defaultValue={initial?.type ?? 'pacing_guide'}>{resourceTypes.map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
    <label>Origin<select name="origin" defaultValue={initial?.origin ?? 'district'}>{['district','state','teacher','publisher','other'].map(v => <option key={v}>{v}</option>)}</select></label>
    <label>Source / publisher name<input aria-label="Source / publisher name" name="sourceName" required maxLength={200} defaultValue={initial?.sourceName} /><small>A source label does not grant access or transfer ownership.</small></label>
    <label className="ct-span">Description<textarea name="description" maxLength={4000} defaultValue={initial?.description} /></label>
    <label>Subject<input name="subject" maxLength={120} defaultValue={initial?.subject} /></label><label>Course<input name="course" maxLength={150} defaultValue={initial?.course} /></label>
    <label>Grades / bands<input name="grades" defaultValue={initial?.grades.join(', ')} placeholder="Separate with commas" /></label>
    <label>Standards references<input name="standards" defaultValue={initial?.standards.join(', ')} placeholder="Separate with commas" /><small>Labels only; alignment is not verified.</small></label>
    <label>Tags<input name="tags" defaultValue={initial?.tags.join(', ')} placeholder="Separate with commas" /></label>
    <label>School year<select name="schoolYearId" defaultValue={initial?.schoolYearId ?? data.profile.selectedSchoolYearId ?? ''}><option value="">Reusable across school years</option>{data.schoolYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
    <fieldset className="ct-span"><legend>Linked Teaching Assignments</legend><p className="ct-small">Optional associations. This stays in your personal library.</p>{data.assignments.map(a => <label className="ct-checkbox" key={a.id}><input type="checkbox" name="assignmentIds" value={a.id} defaultChecked={initial ? initial.assignmentIds.includes(a.id) : a.id === data.profile.selectedAssignmentId} />{a.title}</label>)}</fieldset>
    {!initial && <OriginalFields />}
    <div className="ct-form-actions ct-span"><button className="ct-button" disabled={busy || reading} type="submit">{initial ? 'Save resource details' : 'Save resource'}</button><button type="button" onClick={cancel} disabled={busy || reading}>Cancel</button><small>Private to your workspace · No student information</small></div>
  </form>;
}
