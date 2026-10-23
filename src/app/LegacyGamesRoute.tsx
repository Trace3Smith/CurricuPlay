import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import App from '../App';
import SpellingBee from '../games/spelling-bee/SpellingBee';
import { captureBrowserExport, downloadBrowserState, preserveBrowserState } from '../integrations/legacy-storage/preservation';
import '../styles.css';
// Loaded on demand so the bundled map data stays out of the other games.
const StateLingoBingo = lazy(() => import('../games/state-lingo-bingo/StateLingoBingo'));

export default function LegacyGamesRoute() {
  const route = useLocation();
  const navigate = useNavigate();
  // This initializer runs before any legacy component is mounted or can save recovered state.
  const [preserved] = useState(() => {
    try { return preserveBrowserState(localStorage, location.origin); }
    catch { return { warning: 'Browser storage is unavailable.', archive: undefined }; }
  });
  const [exportNotice, setExportNotice] = useState('');
  useEffect(() => { document.documentElement.dataset.surface = 'games'; document.title = 'Games · ClassThread'; }, []);
  if (!['/games', '/games/', '/games/jeopardy', '/games/four-corners', '/games/spelling-bee', '/games/state-lingo-bingo', '/games/review'].includes(route.pathname)) return <Navigate to="/games" replace />;
  async function backup() {
    try {
      // Prefer the pre-mount legacy values if automatic backup was blocked; Spelling Bee is always read now.
      await downloadBrowserState(captureBrowserExport(localStorage, location.origin, preserved.warning ? preserved.archive : undefined));
      setExportNotice('Games backup downloaded, including Spelling Bee. Nothing was uploaded.');
    } catch { setExportNotice('Backup could not be downloaded. Keep your browser data intact.'); }
  }
  if (route.pathname === '/games/state-lingo-bingo') return <Suspense fallback={<p role="status">Opening State Lingo Bingo…</p>}><StateLingoBingo onHome={() => navigate('/games')} onClassroom={() => navigate('/classroom')} /></Suspense>;
  if (route.pathname === '/games/spelling-bee') return <SpellingBee onHome={() => navigate('/games')} onClassroom={() => navigate('/classroom')} />;
  return <App gamePath={route.pathname} reviewDirect={!route.state?.reviewAll}
    onNavigate={(path, reviewAll) => navigate(path, { state: { reviewAll } })}
    onExit={() => navigate('/classroom')} onBackup={() => void backup()}
    preservationNotice={[preserved.warning, exportNotice].filter(Boolean).join(' ')} />;
}
