import TeamName from './TeamName';
import { useState } from 'react';
import { formatAccuracy, summarizeSession, type GameSession } from './engine';
import './assessment.css';

/** Shared presentation: subjects and teams come from the session, never a fixed curriculum list. */
export default function AssessmentView({ session, live = false }: { session: GameSession; live?: boolean }) {
  const [tab, setTab] = useState<'class' | 'teams' | 'questions'>('class');
  const [page, setPage] = useState(0);
  const data = summarizeSession(session);
  const rows = tab === 'teams' ? data.teams : tab === 'questions' ? data.questions : data.subjects;
  const pageSize = tab === 'questions' ? 2 : tab === 'teams' && data.teams.length > 6 ? 3 : 6;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const shownPage = Math.min(page, pages - 1);
  const range = <T,>(items: T[]) => items.slice(shownPage * pageSize, (shownPage + 1) * pageSize);
  const insights = data.questions.filter(q => q.attempts > 0).sort((a, b) => a.percentage! - b.percentage!);
  return <section className="assessment-view">
    <h1>{live ? 'Live Assessment' : 'Session Report'}</h1>
    <p className="assessment-context">{session.grade === 'K' ? 'Kindergarten' : `Grade ${session.grade}`} · {session.gameType === 'four-corners' ? 'Four Corners' : session.gameType} · {session.teams.length ? `${session.teams.length} teams` : 'Classic Mode'}</p>
    <div className="assessment-metrics">
      <div><span>Overall class accuracy</span><strong data-testid="overall-accuracy">{formatAccuracy(data.overall)}</strong></div>
      <div><span>Questions completed</span><strong data-testid="completed-questions">{data.completedQuestions}</strong></div>
      <div><span>Response attempts collected</span><strong data-testid="response-attempts">{data.overall.attempts}</strong></div>
    </div>
    {session.teams.length === 0 && <p>Classic Mode does not collect team responses or scores.</p>}
    {session.teams.length > 0 && <div className="assessment-scoreboard" aria-label="Final Scoreboard"><strong>{live ? 'Committed scores' : 'Final Scoreboard'}</strong>{data.teams.map(t => <span key={t.id}><TeamName team={t} /> <b>{t.score}</b></span>)}</div>}
    <nav aria-label="Report sections" className="assessment-tabs">{(['class', 'teams', 'questions'] as const).map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setPage(0); }}>{t === 'class' ? 'Class Performance' : t === 'teams' ? 'Team Performance' : 'Question Insights'}</button>)}</nav>
    <div className="assessment-body">
      {tab === 'class' && <>
        <div className="assessment-subjects">{range(data.subjects).map(s => <article key={s.subject}><h2>{s.subject}</h2><strong>{formatAccuracy(s)}</strong></article>)}</div>
        {!data.completedQuestions && <p>No questions committed yet. Reveal, mark correct teams, then select Next Question.</p>}
        {insights.length > 0 && <div className="assessment-insights">{[['Highest accuracy', insights.at(-1)!], ['Most challenging', insights[0]]] .map(([label, item]) => {
          const q = item as typeof insights[number];
          return <article key={label as string}><h2>{label as string}</h2><p>{q.concept || q.prompt}</p><strong>{q.correct}/{q.attempts} teams correct</strong></article>;
        })}</div>}
      </>}
      {tab === 'teams' && <div className="assessment-team-grid">{range(data.teams).map(t => <article key={t.id}><h2><TeamName team={t} /> · {t.score} points</h2><p><strong>Overall: {formatAccuracy(t.overall)}</strong></p>{t.subjects.map(s => <p key={s.subject}>{s.subject}: {formatAccuracy(s)}</p>)}</article>)}</div>}
      {tab === 'questions' && <div className="assessment-question-list">{range(data.questions).map(q => <article key={q.questionId}><h2>{q.subject}{q.concept ? ` · ${q.concept}` : ''}</h2><p>{q.prompt}</p><strong>{q.attempts ? `${q.correct}/${q.attempts} teams correct · ${formatAccuracy(q)}` : '— No team responses'}</strong></article>)}</div>}
    </div>
    {pages > 1 && <div className="assessment-paging"><button disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>Previous</button><span>Page {shownPage + 1} of {pages}</span><button disabled={shownPage === pages - 1} onClick={() => setPage(shownPage + 1)}>Next Page</button></div>}
    {live && <p className="assessment-note">Committed rounds only. The question on screen is not included.</p>}
  </section>;
}
