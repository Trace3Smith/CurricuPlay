import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useFoundation } from '../../app/FoundationProvider';
import { ANSWER_KEY_PATH } from './answerKeyPath';
import './answer-key.css';

// The key itself loads only after the teacher session is confirmed.
const AnswerKey = lazy(() => import('./AnswerKey'));

/** Teacher sign-in required: anyone without a session is sent to sign in and comes back here after. */
export default function AnswerKeyRoute() {
  const { loading, session, error, reload } = useFoundation();
  if (loading) return <p role="status" className="slb-key-wait">Checking teacher sign-in…</p>;
  if (error && !session) return <div className="slb-key-wait"><p role="alert">Teacher sign-in could not be checked. {error}</p><button onClick={() => void reload()}>Try again</button></div>;
  if (!session?.authenticated) return <Navigate to={`/sign-in?next=${encodeURIComponent(ANSWER_KEY_PATH)}`} replace />;
  return <Suspense fallback={<p role="status" className="slb-key-wait">Opening the answer key…</p>}><AnswerKey /></Suspense>;
}
