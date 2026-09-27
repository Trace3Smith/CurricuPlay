import { useState, type FormEvent } from 'react';
import { useFoundation } from '../../app/FoundationProvider';
import { backupKey, captureBrowserState, downloadBrowserState, type BrowserArchive } from '../../integrations/legacy-storage/preservation';

export default function Manage() {
  const { data, busy, mutate } = useFoundation();
  const [exportMessage, setExportMessage] = useState('');
  if (!data) return null;
  const selectedYear = data.schoolYears.find(year => year.id === data.profile.selectedSchoolYearId);
  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await mutate('/profile', 'PATCH', { displayName: values.get('displayName'), timezone: values.get('timezone'), revision: data!.profile.revision }, 'Teacher profile saved.');
  }
  async function year(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (await mutate('/school-years', 'POST', Object.fromEntries(values), 'School year created. Select it in the context bar above.')) form.reset();
  }
  async function assignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const value = { ...Object.fromEntries(values), grades: String(values.get('grades')).split(',').map(value => value.trim()).filter(Boolean), isActive: values.get('isActive') === 'on' };
    if (await mutate('/assignments', 'POST', value, 'Teaching Assignment created. Select it in the context bar above.')) form.reset();
  }
  async function exportData(original: boolean) {
    try {
      const saved = original ? localStorage.getItem(backupKey) : null;
      if (original && !saved) { setExportMessage('No pre-ClassThread browser snapshot was needed on this device. You can export the current Games data.'); return; }
      await downloadBrowserState(saved ? JSON.parse(saved) as BrowserArchive : captureBrowserState(localStorage, location.origin));
      setExportMessage('Browser backup downloaded. It has not been uploaded to your account.');
    } catch { setExportMessage('The backup could not be downloaded. Keep this browser’s data intact and try again.'); }
  }
  return <>
    <div className="ct-page-heading"><div><div className="ct-eyebrow">YOUR FOUNDATION</div><h1>Manage your classroom</h1><p className="ct-lede">Your teaching changes. Your history stays connected to where it happened.</p></div></div>
    <section className="ct-panel" aria-label="Teacher profile"><h2>Teacher profile</h2><form className="ct-form" onSubmit={profile}>
      <label>Your name<input name="displayName" autoComplete="name" required maxLength={100} defaultValue={data.profile.displayName} /></label>
      <label>Timezone<input name="timezone" required defaultValue={data.profile.timezone} list="timezones" /><datalist id="timezones">{['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','Europe/London','UTC'].map(timezone => <option key={timezone} value={timezone} />)}</datalist></label>
      <div className="ct-form-actions ct-span"><button className="ct-button" disabled={busy}>Save profile</button><span className="ct-small">{data.user.email}</span></div>
    </form></section>
    <section className="ct-panel" aria-label="School years"><h2>School years</h2><p>Choose dates for your school’s calendar. Existing years remain available.</p>
      <ul className="ct-record-list">{data.schoolYears.map(year => <li key={year.id}><strong>{year.name}</strong><span>{year.startsOn} — {year.endsOn}</span></li>)}</ul>
      <form className="ct-form" onSubmit={year}><label>School year name<input name="name" required maxLength={80} placeholder="2026–27" /></label><label>School year starts<input name="startsOn" type="date" required /></label><label>School year ends<input name="endsOn" type="date" required /></label><div className="ct-form-actions"><button className="ct-button" disabled={busy}>Create school year</button></div></form>
    </section>
    <section className="ct-panel" aria-label="Teaching Assignments"><h2>Teaching Assignments</h2><p>More than one assignment can be active. Create a new assignment when your school, course, or position changes.</p>
      <ul className="ct-record-list">{data.assignments.map(assignment => <li key={assignment.id}><div><strong>{assignment.title}</strong><p>{assignment.subject} · {data.schoolYears.find(year => year.id === assignment.schoolYearId)?.name} · {assignment.isActive ? 'Active' : 'Inactive'}</p></div><span>{assignment.school}</span></li>)}</ul>
      {!data.schoolYears.length ? <p className="ct-empty-note">Create a school year before adding an assignment.</p> : <form className="ct-form" onSubmit={assignment} key={selectedYear?.id ?? 'no-year'}>
        <label>Assignment name<input name="title" required maxLength={120} placeholder="Economics · Periods 1–3" /></label>
        <label>Assignment school year<select name="schoolYearId" defaultValue={selectedYear?.id} required>{data.schoolYears.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        <label>State / jurisdiction<input name="jurisdiction" required maxLength={100} /></label><label>District<input name="district" maxLength={150} /></label><label>School<input name="school" maxLength={150} /></label>
        <label>Subject<input name="subject" required maxLength={100} placeholder="Any teaching subject" /></label><label>Course<input name="course" maxLength={150} /></label>
        <label>Grades / grade bands<input name="grades" required placeholder="9, 10 or mixed ages" /><small>Separate multiple grades with commas.</small></label>
        <label>Teaching role<input name="teachingRole" required maxLength={100} placeholder="Teacher, PE, intervention…" /></label>
        <label>Assignment starts<input name="startsOn" type="date" required defaultValue={selectedYear?.startsOn} /></label><label>Assignment ends<input name="endsOn" type="date" required defaultValue={selectedYear?.endsOn} /></label>
        <label className="ct-span">Schedule / locations<textarea name="schedule" maxLength={2000} rows={3} placeholder="Days, periods, rooms, or rotating schedule notes" /></label>
        <label className="ct-checkbox"><input type="checkbox" name="isActive" defaultChecked /> Active assignment</label><div className="ct-form-actions"><button className="ct-button" disabled={busy}>Create Teaching Assignment</button></div>
      </form>}
    </section>
    <section className="ct-panel"><h2>Games on this device</h2><p>Your existing games, teacher review decisions, and assessment history stay in this browser. Signing in does not upload or claim them.</p><div className="ct-inline-actions"><button className="ct-button ct-secondary" onClick={() => void exportData(false)}>Export current Games data</button><button className="ct-quiet" onClick={() => void exportData(true)}>Download original preservation snapshot</button></div>{exportMessage && <p role="status">{exportMessage}</p>}</section>
  </>;
}
