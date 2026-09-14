import { useEffect, useState } from 'react';
import { grades, subjects, type Question, type Grade, type ContentRange } from '../types';
import { approvalError, effectiveQuestion, compareReview, reconciliationSummary, changeLabels, writeReview, type Decisions, type ReviewStatus } from '../services/questionReview';
import { localDate } from '../services/curriculumService';
import { createQuestionEngine } from '../services/questionEngine';
import { tiles } from '../games/jeopardy/board';
import curriculum from '../data/curriculum.json';
const label = (g: string) => g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`;
const statuses: Record<ReviewStatus, string> = { pending: 'Pending', approved: 'Approved', 'needs-edit': 'Needs Review', rejected: 'Rejected' };
export default function QuestionReview({ questions, decisions, storageError, onSaved, onClose, initialGrade, onStartTrial }: {
  initialGrade?: Grade; onStartTrial: (grade: Grade, range: ContentRange, asOf: string) => void;
  questions: Question[]; decisions: Decisions; storageError: string; onSaved: (d: Decisions) => void; onClose: () => void;
}) {
  const [filters, setFilters] = useState({ grade: initialGrade ?? '', subject: '', difficulty: '', status: '', materials: '', changes: initialGrade ? 'attention' : '' });
  const [advance, setAdvance] = useState(false);
  const [range, setRange] = useState<ContentRange>('all');
  const [asOf, setAsOf] = useState(localDate);
  const [index, setIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const effective = questions.map(q => effectiveQuestion(q, decisions));
  const changesMatch = (q: Question, saved: Decisions) => { const c = compareReview(questions.find(original => original.id === q.id)!, saved); return !filters.changes || (filters.changes === 'attention' ? c.needsAttention : c.kind === filters.changes); };
  const summary = reconciliationSummary(questions.filter(q => !filters.grade || q.grade === filters.grade), decisions);
  const pool = effective.filter(q => changesMatch(q, decisions) && (!filters.materials || (filters.materials === 'external' ? q.requiresExternalClassroomMaterial !== false : q.requiresExternalClassroomMaterial === false)) && (!filters.grade || q.grade === filters.grade) && (!filters.subject || q.subject === filters.subject) && (!filters.difficulty || String(q.difficulty) === filters.difficulty) && (!filters.status || (q.reviewStatus ?? 'pending') === filters.status));
  const trialFilters = { grade: (filters.grade || '1') as Grade, range, asOf };
  const engine = createQuestionEngine(effective);
  const plan = engine.planQuestions(tiles.map(t => ({ id: t.id, filters: { ...trialFilters, subject: t.category, difficulty: t.difficulty } })));
  const trialCount = engine.getAvailableQuestionCount(trialFilters);
  const position = Math.min(index, Math.max(0, pool.length - 1));
  const current = pool[position];
  function mayLeave() { return !dirty || window.confirm('Discard unsaved question and answer edits? Save with Approve, Edit & Approve, Needs Review, or Reject to keep them.'); }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return <div className="app review-app">
    <header><div className="wordmark">CURRICU<span>PLAY</span></div><button onClick={() => { if (mayLeave()) onClose(); }}>Home</button></header>
    <main className="review-screen">
      <div className="eyebrow">TEACHER TOOLS · INTERNAL CONTENT REVIEW</div><h1>Question Review</h1>
      <p>Review accuracy, evidence, timing, and reading level before approving. A playable question must contain everything needed to answer it; edits must not introduce external references. Decisions and edits stay in this browser. Future content stays excluded from gameplay.</p>
      <div className="review-progress" aria-label="Review progress">{grades.map(g => <span key={g}>{label(g)} — <strong>{effective.filter(q => q.grade === g && q.reviewStatus === 'approved').length} Approved</strong> / {questions.filter(q => q.grade === g).length} Generated / 60 Target</span>)}</div>
      <p role="status">{effective.filter(q => q.reviewStatus === 'approved').length} approved · {effective.filter(q => !q.reviewStatus || q.reviewStatus === 'pending').length} pending · {effective.filter(q => q.reviewStatus === 'needs-edit').length} needs review · {effective.filter(q => q.reviewStatus === 'rejected').length} rejected</p>
      <div className="review-filters">{(['grade', 'subject', 'difficulty', 'status'] as const).map(key => <label key={key}><span id={`review-filter-${key}`}>{key === 'status' ? 'Review status' : key[0].toUpperCase() + key.slice(1)}</span><select aria-labelledby={`review-filter-${key}`} value={filters[key]} onChange={e => { if (mayLeave()) { setDirty(false); setFilters({ ...filters, [key]: e.target.value }); setIndex(0); setMessage(''); } }}>
        <option value="">All</option>{(key === 'grade' ? grades : key === 'subject' ? subjects : key === 'difficulty' ? ['1', '2', '3'] : Object.keys(statuses)).map(v => <option key={v} value={v}>{key === 'grade' ? label(v) : key === 'status' ? statuses[v as ReviewStatus] : v}</option>)}
      </select></label>)}</div>
      <label className="review-field">Gameplay materials<select aria-label="Gameplay materials" value={filters.materials} onChange={e => { if (mayLeave()) { setFilters({ ...filters, materials: e.target.value }); setIndex(0); setDirty(false); } }}><option value="">All questions</option><option value="self-contained">Self-contained only</option><option value="external">External materials — excluded from gameplay</option></select></label>
      <label className="review-field">Changes since human review<select aria-label="Changes since human review" value={filters.changes} onChange={e => { if (mayLeave()) { setFilters({ ...filters, changes: e.target.value }); setIndex(0); setDirty(false); } }}><option value="">All questions</option><option value="attention">Only questions needing attention</option>{Object.entries(changeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      <button onClick={() => { if (mayLeave()) { setFilters({ grade: filters.grade, subject: '', difficulty: '', status: '', materials: '', changes: 'attention' }); setIndex(0); setDirty(false); } }}>Only questions needing attention</button>
      <section className="content-notice" aria-label="Previous human decisions">
        <strong>{filters.grade ? label(filters.grade) : 'All grades'} — previous human decisions in this browser</strong>
        <p>{summary.approvalsSafelyPreserved} approvals safely preserved · {summary.contentChangedReReview} content changed — re-review required · {summary.newReplacementsRequiringReview} new replacements requiring review · {summary.previouslyRejectedRemainRejected} previously rejected remain rejected</p>
        <p>{summary.needsAttention} questions need attention. {summary.noPreviousDecision} questions have no previous human decision saved in this browser. Missing decisions are never inferred from the source drafts.</p>
        <button onClick={() => { void navigator.clipboard.writeText(JSON.stringify({ grade: filters.grade || 'all', ...summary }, null, 2)).then(() => setMessage('Review summary copied.'), () => setMessage('Could not copy. The complete summary is displayed above.')); }}>Copy review summary</button>
      </section>
      {filters.grade && <section className="content-notice" aria-label="Classroom trial readiness">
        <strong>{label(filters.grade)} classroom trial — {trialCount} eligible approved questions · {plan.matched}/30 tiles covered</strong>
        <div className="review-filters"><label>Trial content range<select aria-label="Trial content range" value={range} onChange={e => setRange(e.target.value as ContentRange)}><option value="all">Everything Taught So Far</option><option value="recent">Recent Content</option></select></label><label>Trial content through<input aria-label="Trial content through" type="date" value={asOf} max={localDate()} onChange={e => { if (e.target.value && e.target.value <= localDate()) setAsOf(e.target.value); }} /></label></div>
        <p>{plan.complete ? 'All 30 tiles have distinct eligible questions. Review tiles cannot use another tile’s reserved question.' : 'Approve more questions across the missing category/point pools. A total of 30 approvals alone is not enough.'}</p>
        {!plan.complete && <p>{[...new Set(tiles.filter(t => !plan.assignments[t.id]).map(t => `${t.category} ${t.difficulty}-point`))].join(' · ')}</p>}
        <button className="primary" disabled={!plan.complete || dirty || !!storageError} onClick={() => onStartTrial(trialFilters.grade, range, asOf)}>Start 30-tile classroom trial</button>
      </section>}
      <label><input type="checkbox" checked={advance} onChange={e => setAdvance(e.target.checked)} /> Advance to next question after saving a decision</label>
      <label className="review-field">Jump to a draft<select aria-label="Jump to a draft" value={current?.id ?? ''} onChange={e => { if (mayLeave()) { setIndex(pool.findIndex(q => q.id === e.target.value)); setDirty(false); } }}>{pool.map(q => <option key={q.id} value={q.id}>{q.subject} · {q.difficulty} pt · {statuses[q.reviewStatus ?? 'pending']} · {q.question}</option>)}</select></label>
      {(storageError || message) && <p className="content-notice" role="status">{storageError || message}</p>}
      <div className="review-navigation"><button disabled={!position} onClick={() => { if (mayLeave()) { setDirty(false); setIndex(position - 1); setMessage(''); } }}>← Previous</button><span>{pool.length ? `${position + 1} of ${pool.length} matching questions` : 'No matching questions'}</span><button disabled={position >= pool.length - 1} onClick={() => { if (mayLeave()) { setDirty(false); setIndex(position + 1); setMessage(''); } }}>Next →</button></div>
      {current ? <ReviewCard key={JSON.stringify([current.id, decisions[current.id], filters])} question={current} original={questions.find(q => q.id === current.id)!} comparison={compareReview(questions.find(q => q.id === current.id)!, decisions)} onDirty={setDirty} onDecision={(status, question, answer, confirmed) => {
        const result = writeReview(questions.find(q => q.id === current.id)!, status, question, answer, confirmed);
        if (result.decisions) { if (advance && changesMatch(current, result.decisions) && (!filters.status || filters.status === status)) setIndex(Math.min(position + 1, pool.length - 1)); onSaved(result.decisions); setDirty(false); setMessage(`${current.id}: ${statuses[status]} saved locally.`); } else setMessage(result.error);
      }} /> : <p className="content-notice">No questions match these filters. Choose another review status or clear the filters.</p>}
    </main>
  </div>;
}
function ReviewCard({ question: q, original, comparison, onDirty, onDecision }: {
  question: Question; original: Question; comparison: ReturnType<typeof compareReview>; onDirty: (dirty: boolean) => void; onDecision: (status: ReviewStatus, question: string, answer: string, confirmed?: boolean) => void;
}) {
  const [question, setQuestion] = useState(q.question);
  const [answer, setAnswer] = useState(q.answer);
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirmation = q.requiresExternalClassroomMaterial === false && (question.trim() !== original.question || answer.trim() !== original.answer);
  const dirty = question !== q.question || answer !== q.answer;
  const rows = curriculum.filter(r => (original.curriculumIds ?? [original.curriculumId]).includes(r.id));
  const invalid = approvalError(question, answer);
  const future = q.weekIntroduced > localDate();
  return <article className="review-card">
    <div className="review-card-heading"><h2>{label(q.grade)} · {q.subject} · {q.difficulty} {q.difficulty === 1 ? 'point' : 'points'}</h2><strong>{statuses[q.reviewStatus ?? 'pending']}{dirty ? ' · Unsaved edits' : ''}</strong></div>
    <p className="content-notice">{changeLabels[comparison.kind]}{comparison.changedFields.length > 0 && <span> · Compared fields: {comparison.changedFields.join(', ')}</span>}</p>
    <p className="warning">{q.requiresExternalClassroomMaterial !== false ? 'EXTERNAL CLASSROOM MATERIAL REQUIRED — EXCLUDED FROM GAMEPLAY EVEN IF APPROVED' : 'SELF-CONTAINED — no external classroom resource required'}</p><p>{q.materialReviewNote}</p>
    <p className="warning">{[q.questionType === 'teacher-check' || q.answer.startsWith('Teacher checks:') ? 'TEACHER CHECK REQUIRED' : 'Answer supplied', q.teacherSetup ? 'CLASSROOM MATERIALS / PREPARATION REQUIRED' : '', /word wall/i.test([q.question, q.answer, q.teacherSetup].join(' ')) ? 'WORD WALL REQUIRED' : '', rows.some(r => r.needsAdditionalSourceMaterial) ? 'PACING ROW HAS UNRESOLVED REFERENCES — inspect evidence' : ''].filter(Boolean).join(' · ')}</p>
    <div className="review-columns"><section aria-label="Question editor">
      <p className="read-note">{q.grade === 'K' ? 'TEACHER READS QUESTION ALOUD' : q.grade === '1' ? 'TEACHER MAY READ QUESTION ALOUD' : q.teacherRead ? 'TEACHER READS QUESTION ALOUD' : 'Teacher may read aloud'}</p>
      <label className="review-field"><span id="review-question-label">Question</span><textarea aria-labelledby="review-question-label" rows={3} value={question} onChange={e => { setQuestion(e.target.value); onDirty(e.target.value !== q.question || answer !== q.answer); }} /></label>
      <small>{question.length} / 240 characters</small>
      {q.choices && <p>Choices (from source draft): {q.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join(' · ')}</p>}
      <label className="review-field"><span id="review-answer-label">Answer</span><textarea aria-labelledby="review-answer-label" rows={3} value={answer} onChange={e => { setAnswer(e.target.value); onDirty(question !== q.question || e.target.value !== q.answer); }} /></label><small>{answer.length} / 300 characters</small>
      <p><strong>Teacher checking / classroom materials:</strong> {q.teacherSetup || 'No additional setup is specified. Verify that the answer can be checked as written.'}</p>
      {invalid && <p role="alert" className="warning">{invalid}</p>}
      {['K', '1'].includes(q.grade) && question.trim().split(/\s+/).length > 30 && <p className="warning">Reading-level warning: this K–1 prompt exceeds 30 words. Shorten it or check that it works when read aloud.</p>}
      {needsConfirmation && <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> My edits need no external classroom resource; all required information is displayed.</label>}
      <div className="review-actions"><button className="primary" disabled={!!invalid || dirty || (needsConfirmation && !confirmed)} onClick={() => onDecision('approved', question, answer, confirmed)}>Approve</button><button className="primary" disabled={!!invalid || !dirty || (needsConfirmation && !confirmed)} onClick={() => onDecision('approved', question, answer, confirmed)}>Edit &amp; Approve</button><button onClick={() => onDecision('needs-edit', question, answer)}>Needs Review</button><button onClick={() => onDecision('rejected', question, answer)}>Reject</button></div>
      <p className="hint">Edit the fields, then use Edit & Approve to approve changed wording. Each action saves locally. Needs Review and Reject exclude this question from play. Approval still uses the selected grade, range, and content date.</p>
    </section><section className="review-evidence" aria-label="Source and evidence">
      <h3>Timing & evidence</h3><dl><dt>Question ID</dt><dd>{q.id}</dd><dt>Standard / unit / session</dt><dd>{q.standard || 'Standard not specified'} · {q.unit || 'Unit not specified'} · {q.session || 'Session not specified'}</dd><dt>Introduced</dt><dd>{q.weekIntroduced}</dd><dt>Aligned instructional weeks</dt><dd>{(q.alignedWeeks ?? [q.weekIntroduced]).join(', ')}</dd><dt>Source</dt><dd><SourceLink url={q.sourceUrl} label={q.source} /></dd></dl>
      {q.evidence ? <><SourceLink url={q.evidence.sourceUrl} label={q.evidence.sourceTitle} /><p>{q.evidence.section}</p><blockquote>{q.evidence.quote}</blockquote><p><strong>Timing basis:</strong> {q.evidence.timingBasis}</p></> : <p className="warning">No detailed evidence attached. Additional source verification is needed.</p>}
      <h3>Warnings & review notes</h3>{!comparison.preserved && comparison.kind !== 'unreviewed' && <p className="warning">Earlier approval cannot be used for this draft. Any previous rejection remains in force until you explicitly change it. Review the current wording and evidence.</p>}{future && <p className="warning">Future instructional content: excluded from gameplay even if approved.</p>}
      <p>{q.reviewNote || 'Check wording, answer, difficulty, and alignment against the evidence.'}</p>
      {rows.map(row => <details key={row.id}><summary>{row.sourceSheet}, row {row.sourceRow} · {row.generationStatus.replaceAll('_', ' ')}</summary><p>{row.reason}</p><p>Week {row.instructionalWeek ?? 'unresolved'} · {row.sourceDateText}</p>{row.sourceCells.map(c => <p key={c.cell}>{c.cell}: {c.text}</p>)}</details>)}
      {rows.some(r => r.needsAdditionalSourceMaterial || r.generationStatus === 'needs_timing_review') && <p className="warning">The linked pacing row has unresolved or incomplete information. Approval applies only to the supported question; it does not resolve the rest of the pacing row. Inspect the row notes above.</p>}
    </section></div>
  </article>;
}
function SourceLink({ url, label }: { url?: string; label: string }) {
  return url && /^https?:\/\//.test(url) ? <a href={url} target="_blank" rel="noreferrer">{label} ↗</a> : <span>{label}</span>;
}
