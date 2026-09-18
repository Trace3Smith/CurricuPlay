/** Game-independent, immutable assessment records. No browser or game imports. */
export type GameType = 'four-corners' | 'jeopardy' | (string & {});
export interface AssessmentTeam { id: string; name: string; accent?: string }
export interface AssessmentQuestionSnapshot {
  questionId: string; subject: string; standards?: string[]; concept?: string; prompt: string;
}
export interface AssessmentResponse {
  questionId: string; teamId: string; subject: string; standards?: string[]; concept?: string;
  correct: boolean; pointsAwarded: number; answeredAt: string;
}
export interface GameSession {
  version: 1; id: string; gameType: GameType; grade: string; mode: string;
  startedAt: string; endedAt?: string; teams: AssessmentTeam[];
  questions: AssessmentQuestionSnapshot[]; responses: AssessmentResponse[];
}
export interface Outcome { teamId: string; correct: boolean; pointsAwarded: number }
export interface Accuracy { correct: number; attempts: number; percentage: number | null }
export function accuracy(responses: readonly AssessmentResponse[]): Accuracy {
  const correct = responses.filter(r => r.correct).length;
  return { correct, attempts: responses.length, percentage: responses.length ? correct / responses.length * 100 : null };
}
export function formatAccuracy(value: Accuracy): string {
  return value.percentage === null ? '—' : `${Number(value.percentage.toFixed(1))}% (${value.correct}/${value.attempts})`;
}
export function createSession(input: Pick<GameSession, 'id' | 'gameType' | 'grade' | 'mode' | 'startedAt' | 'teams'>): GameSession {
  return { ...input, teams: input.teams.map(t => ({ ...t })), version: 1, questions: [], responses: [] };
}
/** Append once. Repeating an already committed question cannot award points twice. */
export function commitQuestion(session: GameSession, question: AssessmentQuestionSnapshot, outcomes: readonly Outcome[], answeredAt: string): GameSession {
  if (session.endedAt || session.questions.some(q => q.questionId === question.questionId)) return session;
  if (!question.questionId || !question.subject || !question.prompt || !Number.isFinite(Date.parse(answeredAt))) throw new Error('Invalid assessment question or time');
  const teamIds = new Set(session.teams.map(t => t.id));
  if (new Set(outcomes.map(o => o.teamId)).size !== outcomes.length || outcomes.some(o => !teamIds.has(o.teamId) || typeof o.correct !== 'boolean' || !Number.isFinite(o.pointsAwarded))) throw new Error('Invalid assessment outcomes');
  const snapshot = { ...question, standards: question.standards ? [...question.standards] : undefined };
  return { ...session, questions: [...session.questions, snapshot], responses: [...session.responses, ...outcomes.map(o => ({ ...o, questionId: snapshot.questionId, subject: snapshot.subject, standards: snapshot.standards, concept: snapshot.concept, answeredAt }))] };
}
export function endSession(session: GameSession, endedAt: string): GameSession {
  return session.endedAt ? session : { ...session, endedAt };
}
export function summarizeSession(session: GameSession, additionalSubjects: readonly string[] = []) {
  const subjects = [...new Set([...session.questions.map(q => q.subject), ...additionalSubjects])];
  const bySubject = (responses: AssessmentResponse[]) => subjects.map(subject => ({ subject, ...accuracy(responses.filter(r => r.subject === subject)) }));
  return {
    overall: accuracy(session.responses), subjects: bySubject(session.responses), completedQuestions: session.questions.length,
    teams: session.teams.map(team => {
      const responses = session.responses.filter(r => r.teamId === team.id);
      return { ...team, score: responses.reduce((sum, r) => sum + r.pointsAwarded, 0), overall: accuracy(responses), subjects: bySubject(responses) };
    }),
    questions: session.questions.map(q => ({ ...q, ...accuracy(session.responses.filter(r => r.questionId === q.questionId)) })),
  };
}
/** Validate stored snapshots without consulting a game's current question bank. */
export function isGameSession(value: unknown): value is GameSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameSession;
  const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
  const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
  const metadata = (v: AssessmentQuestionSnapshot | AssessmentResponse) => (v.standards === undefined || (Array.isArray(v.standards) && v.standards.every(text))) && (v.concept === undefined || text(v.concept));
  if (s.version !== 1 || !text(s.id) || !text(s.gameType) || !text(s.grade) || !text(s.mode) || !date(s.startedAt) || (s.endedAt !== undefined && (!date(s.endedAt) || s.endedAt < s.startedAt)) || !Array.isArray(s.teams) || !Array.isArray(s.questions) || !Array.isArray(s.responses)) return false;
  if (!s.teams.every(t => t && text(t.id) && text(t.name) && (t.accent === undefined || /^#[0-9a-f]{6}$/i.test(t.accent))) || new Set(s.teams.map(t => t.id)).size !== s.teams.length) return false;
  if (!s.questions.every(q => q && text(q.questionId) && text(q.subject) && text(q.prompt) && metadata(q)) || new Set(s.questions.map(q => q.questionId)).size !== s.questions.length) return false;
  const keys = new Set<string>();
  return s.responses.every(r => {
    if (!r || !s.teams.some(t => t.id === r.teamId) || !date(r.answeredAt) || r.answeredAt < s.startedAt || (s.endedAt && r.answeredAt > s.endedAt) || typeof r.correct !== 'boolean' || !Number.isFinite(r.pointsAwarded) || !metadata(r)) return false;
    const q = s.questions.find(q => q.questionId === r.questionId);
    const key = JSON.stringify([r.questionId, r.teamId]);
    if (!q || q.subject !== r.subject || q.concept !== r.concept || JSON.stringify(q.standards) !== JSON.stringify(r.standards) || keys.has(key)) return false;
    keys.add(key); return true;
  });
}
