import { Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { FoundationProvider, useFoundation } from './FoundationProvider';
import Shell from './Shell';
import SignIn from '../modules/profile/SignIn';
import MyClassroom from '../modules/classroom/MyClassroom';
import Manage from '../modules/profile/Manage';
import WorkQueue from '../modules/work/WorkQueue';
import GamesEntry from './GamesEntry';
import Resources from '../modules/resources/Resources';
import ResourceDetail from '../modules/resources/ResourceDetail';
import Plan from '../modules/lessons/Plan';

function Protected() {
  const { loading, session, data, error } = useFoundation();
  if (loading) return <p role="status">Opening your classroom…</p>;
  if (error && !data) return <p>Your records are unavailable. Use Reload records above to try again.</p>;
  if (!session?.authenticated) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
function RootRedirect() {
  const { hash } = useLocation();
  if (hash === '#four-corners') return <Navigate to="/games/four-corners" replace />;
  if (hash === '#review') return <Navigate to="/games/review" replace />;
  return <Navigate to="/classroom" replace />;
}
function FutureArea({ name }: { name: string }) {
  return <div className="ct-future"><span className="ct-eyebrow">A LITTLE FURTHER DOWN THE ROAD</span><h1>{name}</h1><p>This part of ClassThread is planned for a later increment. Your profile, assignments, Work Queue, and Games are ready to use.</p><Link className="ct-button" to="/classroom">Back to My Classroom</Link></div>;
}
export default function ClassThreadRouter() {
  return <BrowserRouter><Suspense fallback={<p role="status">Opening Games…</p>}><Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/games/*" element={<GamesEntry />} />
    <Route element={<FoundationProvider><Shell /></FoundationProvider>}>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<Protected />}>
        <Route path="/classroom" element={<MyClassroom />} />
        <Route path="/manage" element={<Manage />} />
        <Route path="/manage/work" element={<WorkQueue />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:resourceId" element={<ResourceDetail />} />
        <Route path="/resources/:resourceId/review/:curriculumId" element={<ResourceDetail />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/plan/new" element={<Plan />} />
        <Route path="/plan/:lessonId" element={<Plan />} />
        <Route path="/plan/:lessonId/revise" element={<Plan />} />
        {['Teach', 'Assess', 'Create', 'Evidence', 'Calendar'].map(name => <Route key={name} path={`/${name.toLowerCase()}`} element={<FutureArea name={name} />} />)}
      </Route>
      <Route path="*" element={<div className="ct-future"><h1>That page isn’t here.</h1><Link to="/classroom">Go to My Classroom</Link></div>} />
    </Route>
  </Routes></Suspense></BrowserRouter>;
}
