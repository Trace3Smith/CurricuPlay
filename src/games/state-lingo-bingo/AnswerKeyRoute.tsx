import { lazy, Suspense, useEffect } from 'react';
import './answer-key.css';

const AnswerKey = lazy(() => import('./AnswerKey'));

/** The answer key opens without sign-in, but asks search engines not to list it (vercel.json also sends X-Robots-Tag). */
export default function AnswerKeyRoute() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return <Suspense fallback={<p role="status" className="slb-key-wait">Opening the answer key…</p>}><AnswerKey /></Suspense>;
}
