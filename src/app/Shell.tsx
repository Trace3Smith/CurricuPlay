import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFoundation } from './FoundationProvider';
import './class-thread.css';

const links = [['My Classroom', '/classroom', '⌂'], ['Plan', '/plan', '▤'], ['Teach', '/teach', '◷'], ['Games', '/games', '◇'], ['Assess', '/assess', '✓'], ['Manage', '/manage', '☷'], ['Create', '/create', '+'], ['Resources', '/resources', '▧'], ['Evidence', '/evidence', '◎'], ['Calendar', '/calendar', '▦']];
export default function Shell() {
  const { session, data, busy, error, notice, reload, mutate, signOut } = useFoundation();
  const location = useLocation();
  useEffect(() => { document.documentElement.dataset.surface = 'classroom'; }, []);
  useEffect(() => { document.title = `${links.find(([, path]) => location.pathname.startsWith(path))?.[0] ?? 'Welcome'} · ClassThread`; }, [location.pathname]);
  const selectedYear = data?.profile.selectedSchoolYearId ?? '';
  return <div className="ct">
    <a className="ct-skip" href="#classroom-content">Skip to content</a>
    <aside className="ct-sidebar">
      <Link className="ct-brand" to="/classroom"><span className="ct-mark" aria-hidden="true">C<span>↗</span></span>ClassThread</Link>
      <span className="ct-edition">TEACHER FOUNDATION · ALPHA</span>
      <nav aria-label="ClassThread">{links.map(([label, path, glyph]) => <NavLink key={path} to={path}><span aria-hidden="true">{glyph}</span>{label}</NavLink>)}</nav>
      <div className="ct-sidebar-footer"><strong>A little more room to teach.</strong><span>Your work, connected.</span></div>
    </aside>
    <div className="ct-workspace">
      <header className="ct-header">
        <div className="ct-context">
          <label>School year<select aria-label="Active school year" value={selectedYear} disabled={!data || busy} onChange={event => void mutate('/context', 'PATCH', { schoolYearId: event.target.value || null, assignmentId: null, revision: data!.profile.revision }, 'School year selected.')}><option value="">Select school year</option>{data?.schoolYears.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
          <label>Teaching Assignment<select aria-label="Active Teaching Assignment" value={data?.profile.selectedAssignmentId ?? ''} disabled={!selectedYear || busy} onChange={event => void mutate('/context', 'PATCH', { schoolYearId: selectedYear, assignmentId: event.target.value || null, revision: data!.profile.revision }, 'Teaching context selected.')}><option value="">All assignments</option>{data?.assignments.filter(assignment => assignment.schoolYearId === selectedYear).map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.title}{assignment.isActive ? '' : ' · inactive'}</option>)}</select></label>
        </div>
        <div className="ct-account">{session?.authenticated ? <><Link to="/manage">{data?.profile.displayName || 'Teacher profile'}</Link><button className="ct-quiet" disabled={busy} onClick={() => void signOut()}>Sign out</button></> : <Link to="/sign-in">Sign in</Link>}</div>
      </header>
      <main id="classroom-content" className="ct-content">
        {session?.fixture && <p className="ct-fixture" role="status">Development fixture · Local test accounts and database. No real email or Google connection.</p>}
        {error && <div className="ct-alert" role="alert">{error} <button onClick={() => void reload()} disabled={busy}>Reload records</button></div>}
        {notice && <p className="ct-notice" role="status">{notice}</p>}
        <Outlet />
      </main>
    </div>
  </div>;
}
