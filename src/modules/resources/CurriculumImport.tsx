import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../app/api';
import { useFoundation } from '../../app/FoundationProvider';
import { authorityPurposes, curriculumFields, fieldLabels, type CurriculumField, type GridPreview, type ResourceLibrary } from '../../../shared/contracts/resources';
import type { ResourceState } from './useResources';

export default function CurriculumImport({ resourceId, state, data }: { resourceId: string; state: ResourceState; data: ResourceLibrary }) {
  const { data: foundation } = useFoundation(); const navigate = useNavigate();
  const files = data.versions.filter(v => v.kind === 'file').sort((a,b) => b.number-a.number);
  const [versionId, setVersionId] = useState(files[0]?.id ?? ''); const [grid, setGrid] = useState<GridPreview | null>(null); const [error, setError] = useState('');
  const [sheet, setSheet] = useState(''); const [columns, setColumns] = useState<{ field: CurriculumField; column: string }[]>([{ field: 'topic', column: '' }]);
  useEffect(() => {
    if (!versionId) return;
    const abort = new AbortController(); setGrid(null); setError('');
    void api<GridPreview>(`/resources/${resourceId}/versions/${versionId}/preview`, 'GET', undefined, abort.signal).then(value => {
      if (!abort.signal.aborted) { setGrid(value); setSheet(value.sheets.find(s => !s.hidden)?.name ?? value.sheets[0]?.name ?? ''); setColumns([{ field: 'topic', column: '' }]); }
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [versionId, resourceId]);
  const selected = grid?.sheets.find(s => s.name === sheet);
  const assignment = foundation?.assignments.find(a => a.id === foundation.profile.selectedAssignmentId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const result = await state.run(() => api<{ id: string }>(`/resources/${resourceId}/curriculum`, 'POST', { resourceVersionId: versionId, label: String(f.get('label')), effectiveFrom: f.get('effectiveFrom'), effectiveTo: f.get('effectiveTo'), purposes: f.getAll('purposes'), mapping: { sheet, firstRow: Number(f.get('firstRow')), lastRow: Number(f.get('lastRow')), columns }, supersedesId: f.get('supersedesId') || null }), 'Curriculum extracted. Review every assertion before approval.');
    if (result) navigate(`/resources/${resourceId}/review/${result.id}`);
  }
  return <section className="ct-panel"><h2>Structure curriculum from this source</h2><p>Choose the original, rows, and column meanings. ClassThread copies only text present in those cells. Dates are not inferred, formulas do not run, and linked documents are not fetched.</p>
    {!files.length ? <p>Upload a CSV or spreadsheet JSON snapshot first. A saved link alone cannot be extracted.</p> : <>
      <label>Original to review<select value={versionId} onChange={e => setVersionId(e.target.value)}>{files.map(v => <option key={v.id} value={v.id}>Original {v.number} · {v.fileName}</option>)}</select></label>
      {error && <p role="alert" className="ct-alert">{error}</p>}
      {!grid && !error && <p role="status">Reading the original table…</p>}
      {grid && <form className="ct-form" onSubmit={submit}>
        <label>Sheet<select value={sheet} onChange={e => { setSheet(e.target.value); setColumns([{ field: 'topic', column: '' }]); }}>{grid.sheets.map(s => <option key={s.name} value={s.name}>{s.name}{s.hidden ? ' (hidden in source)' : ''}</option>)}</select></label>
        <label>Curriculum label<input name="label" required maxLength={160} defaultValue={`${data.resources[0].metadata.title} · review ${data.curriculum.length+1}`} /></label>
        <details className="ct-span"><summary>Preview source cells (first 12 populated rows)</summary><div className="ct-table-scroll"><table className="ct-source-table"><thead><tr><th>Row</th><th>Literal source cells</th></tr></thead><tbody>{selected?.sample.map(r => <tr key={r.row}><th>{r.row}</th><td>{Object.entries(r.cells).map(([column, text]) => <p key={column}><strong>{column}{r.row}</strong> {text}</p>)}</td></tr>)}</tbody></table></div></details>
        <label>First data row<input key={`start-${sheet}`} name="firstRow" type="number" min={1} max={selected?.rowCount || 1} defaultValue={sheet === 'CSV' && (selected?.rowCount ?? 0)>1 ? 2 : 1} required /></label>
        <label>Last data row<input key={`end-${sheet}`} name="lastRow" type="number" min={1} max={selected?.rowCount || 1} defaultValue={Math.min(selected?.rowCount || 1, 20)} required /><small>Up to 500 rows / 1,500 assertions. Exclude headings and unrelated rows.</small></label>
        <fieldset className="ct-span"><legend>Map selected columns</legend><p className="ct-small">Leave unsupported fields out. Each nonempty mapped cell becomes a cited assertion.</p>{columns.map((mapping, index) => <div className="ct-mapping" key={index}>
          <label>Column {index+1}<select value={mapping.column} required onChange={e => setColumns(current => current.map((c,i) => i === index ? { ...c, column: e.target.value } : c))}><option value="">Choose column</option>{selected?.columns.map(col => <option key={col}>{col}</option>)}</select></label>
          <label>Meaning {index+1}<select value={mapping.field} onChange={e => setColumns(current => current.map((c,i) => i === index ? { ...c, field: e.target.value as CurriculumField } : c))}>{curriculumFields.map(field => <option key={field} value={field}>{fieldLabels[field]}</option>)}</select></label>
          <button type="button" disabled={columns.length === 1} onClick={() => setColumns(current => current.filter((_,i) => i !== index))}>Remove</button>
        </div>)}<button type="button" disabled={columns.length >= 30} onClick={() => setColumns(current => [...current,{ field: 'notes', column: '' }])}>Add column</button></fieldset>
        <fieldset className="ct-span"><legend>This source’s authority by purpose</legend><p className="ct-small">Your declaration for this source version; no global source ranking or verified standard alignment is implied.</p><div className="ct-purpose-grid">{authorityPurposes.map(p => <label className="ct-checkbox" key={p}><input type="checkbox" name="purposes" value={p} />{p.replaceAll('_',' ')}</label>)}</div></fieldset>
        <label>Effective from<input name="effectiveFrom" type="date" defaultValue={assignment?.startsOn} required /><small>You choose the applicability period; it is separate from extracted timing.</small></label>
        <label>Effective through<input name="effectiveTo" type="date" defaultValue={assignment?.endsOn} required /></label>
        <label className="ct-span">Revises an earlier curriculum<select name="supersedesId" defaultValue={data.curriculum[0]?.id ?? ''}><option value="">First / independent curriculum version</option>{data.curriculum.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select><small>The earlier original, review, and assignment bindings will remain available.</small></label>
        <div className="ct-form-actions ct-span"><button className="ct-button" disabled={state.busy}>Extract for review</button><small>No generated suggestions or lesson plans are created.</small></div>
      </form>}
    </>}
  </section>;
}
