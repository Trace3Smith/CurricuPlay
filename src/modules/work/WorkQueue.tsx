import { useState, type FormEvent } from 'react';
import { visibleWork } from '../../../shared/contracts/foundation';
import { useFoundation } from '../../app/FoundationProvider';

export default function WorkQueue() {
  const { data, busy, mutate } = useFoundation();
  const [showForm, setShowForm] = useState(false);
  const [all, setAll] = useState(false);
  if (!data) return null;
  const items = all ? data.workItems : visibleWork(data.workItems, data.profile.selectedAssignmentId);
  const active = items.filter(item => item.status === 'open' || item.status === 'in_progress');
  const completed = items.filter(item => item.status === 'completed' || item.status === 'cancelled');
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const saved = await mutate('/work-items', 'POST', { title: values.get('title'), description: values.get('description'), assignmentId: values.get('assignmentId') || null, dueOn: values.get('dueOn') || null, priority: values.get('priority') }, 'Work item saved.');
    if (saved) { form.reset(); setShowForm(false); }
  }
  function rows(values: typeof items) {
    return values.map(item => <li className="ct-task" key={item.id}>
      <button className={`ct-task-check ${item.status === 'completed' ? 'is-complete' : ''}`} aria-label={`${item.status === 'completed' ? 'Reopen' : 'Complete'} ${item.title}`} disabled={busy} onClick={() => void mutate(`/work-items/${item.id}`, 'PATCH', { status: item.status === 'completed' ? 'open' : 'completed', revision: item.revision }, item.status === 'completed' ? 'Work item reopened.' : 'Work item completed.')}>{item.status === 'completed' ? '✓' : ''}</button>
      <div className="ct-task-body"><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}<div className="ct-task-meta"><span>{data!.assignments.find(assignment => assignment.id === item.assignmentId)?.title ?? 'Personal workspace'}</span><span>{item.dueOn ? `Due ${item.dueOn}` : 'No due date'}</span><span>{item.source}</span>{item.status === 'completed' && <span>Completed</span>}</div></div>
      <span className={`ct-priority ct-priority-${item.priority}`}>{item.priority}</span>
    </li>);
  }
  return <section className="ct-panel ct-queue" aria-label="Work Queue">
    <div className="ct-section-heading"><div><span className="ct-eyebrow">YOUR NEXT STEPS</span><h2>Work Queue <span className="ct-count">{active.length}</span></h2></div><button className="ct-button" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : '+ Add work item'}</button></div>
    <label className="ct-checkbox"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} /> Show work from all assignments</label>
    {showForm && <form className="ct-form ct-task-form" onSubmit={create}>
      <label className="ct-span">What needs doing?<input name="title" required maxLength={200} autoFocus /></label>
      <label className="ct-span">Details<textarea name="description" maxLength={4000} rows={2} /></label>
      <label>Assignment for this work<select name="assignmentId" defaultValue={data.profile.selectedAssignmentId ?? ''}><option value="">Personal workspace</option>{data.assignments.map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}</select></label>
      <label>Due date<input type="date" name="dueOn" /></label>
      <label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      <div className="ct-form-actions"><button className="ct-button" disabled={busy}>Save work item</button></div>
    </form>}
    {active.length ? <ul className="ct-task-list">{rows(active)}</ul> : <div className="ct-empty"><span aria-hidden="true">✓</span><h3>A little breathing room.</h3><p>No open work items in this view. Add your next step when you’re ready.</p></div>}
    {!!completed.length && <details className="ct-completed"><summary>Completed and closed ({completed.length})</summary><ul className="ct-task-list">{rows(completed)}</ul></details>}
  </section>;
}
