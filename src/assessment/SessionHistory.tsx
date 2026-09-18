import { useState } from 'react';
import AssessmentView from './AssessmentView';
import { formatAccuracy, summarizeSession, type GameSession } from './engine';
import { readHistory } from './storage';
export default function SessionHistory({ presentSession = s => s }: { presentSession?: (session: GameSession) => GameSession }) {
  const [history] = useState(readHistory);
  const [selected, setSelected] = useState<GameSession | null>(null);
  const [page, setPage] = useState(0);
  if (selected) return <><button onClick={() => setSelected(null)}>Back to History</button><AssessmentView session={presentSession(selected)} /></>;
  const pages = Math.max(1, Math.ceil(history.sessions.length / 5));
  return <section><h1>Session History</h1><p>Saved in this browser · No student names</p>
    {history.error && <p role="alert">{history.error}</p>}
    {!history.error && !history.sessions.length && <p>No completed sessions yet.</p>}
    <div className="assessment-history-list">{history.sessions.slice(page * 5, page * 5 + 5).map(session => {
      const report = summarizeSession(session);
      return <button key={session.id} onClick={() => setSelected(session)}>{session.grade === 'K' ? 'Kindergarten' : `Grade ${session.grade}`} · {session.gameType === 'four-corners' ? 'Four Corners' : session.gameType} · {new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{session.teams.length ? `${session.teams.length} teams` : 'Classic Mode'} · {report.completedQuestions} questions · {formatAccuracy(report.overall)} class accuracy</small></button>;
    })}</div>
    {pages > 1 && <div className="assessment-paging"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page === pages - 1} onClick={() => setPage(page + 1)}>Next Page</button></div>}
  </section>;
}
