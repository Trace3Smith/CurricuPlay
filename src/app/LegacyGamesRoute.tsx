import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import App from '../App';
import { captureBrowserState, downloadBrowserState, preserveBrowserState } from '../integrations/legacy-storage/preservation';
import '../styles.css';

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
  if (!['/games', '/games/', '/games/jeopardy', '/games/four-corners', '/games/review'].includes(route.pathname)) return <Navigate to="/games" replace />;
  async function backup() {
    try {
      // Prefer the captured raw values if automatic backup was blocked.
      await downloadBrowserState(preserved.warning && preserved.archive ? preserved.archive : captureBrowserState(localStorage, location.origin));
      setExportNotice('Games backup downloaded. Nothing was uploaded.');
    } catch { setExportNotice('Backup could not be downloaded. Keep your browser data intact.'); }
  }
  return <App gamePath={route.pathname} reviewDirect={!route.state?.reviewAll}
    onNavigate={(path, reviewAll) => navigate(path, { state: { reviewAll } })}
    onExit={() => navigate('/classroom')} onBackup={() => void backup()}
    preservationNotice={[preserved.warning, exportNotice].filter(Boolean).join(' ')} />;
}
