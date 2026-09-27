import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../../app/api';
import { useFoundation } from '../../app/FoundationProvider';

export default function SignIn() {
  const { session, loading, reload } = useFoundation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.has('error') ? 'Sign-in could not be completed. Please try again.' : '');
  if (session?.authenticated) return <Navigate to="/classroom" replace />;
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/email', 'POST', { email }); setSent(true); } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/verify', 'POST', { email, token }); await reload(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function google() {
    setBusy(true); setError('');
    try { const result = await api<{ url: string }>('/auth/google', 'POST', {}); window.location.assign(result.url); } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  const disabled = loading || !session?.configured || busy;
  return <section className="ct-sign-in">
    <div className="ct-eyebrow">WELCOME TO YOUR CLASSROOM</div>
    <h1>Everything starts<br />with a little connection.</h1>
    <p className="ct-lede">A home for your teaching assignments, your next steps, and the work that matters.</p>
    {session && !session.configured && <div className="ct-alert" role="status">Sign-in is not configured yet. Your existing Games are available below. Follow the repository’s Increment 1 setup guide to connect a development project.</div>}
    <div className="ct-panel ct-login-panel">
      <button className="ct-button ct-google" disabled={disabled || session?.fixture} onClick={() => void google()}>Continue with Google</button>
      <div className="ct-divider">or use your email</div>
      {!sent ? <form onSubmit={send}>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="ct-button" disabled={disabled}>Send sign-in code</button>
      </form> : <form onSubmit={verify}>
        <p role="status">A sign-in code was requested for <strong>{email}</strong>.</p>
        <label>Email code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={token} onChange={event => setToken(event.target.value)} /></label>
        <button className="ct-button" disabled={disabled}>Verify and sign in</button>
        <button type="button" className="ct-quiet" disabled={busy} onClick={() => { setSent(false); setToken(''); }}>Use another email or request a new code</button>
      </form>}
      {error && <p className="ct-alert" role="alert">{error}</p>}
      <p className="ct-small">Email codes also restore access to your existing account. Sign-in connects your identity only. Drive, email, and calendar access are separate.</p>
    </div>
    <Link className="ct-text-link" to="/games">Open Games on this device →</Link>
  </section>;
}
