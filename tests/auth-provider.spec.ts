import { test, expect } from '@playwright/test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createSupabasePorts } from '../server/providers/supabase';

const config = { url: 'https://provider.example.test', publishableKey: 'test-publishable-key', origin: 'https://classroom.example.test' };
const user = { id: '85a4d220-10b5-458c-b4f3-540f4d0a96bf', email: 'teacher@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, is_anonymous: false };
const token = () => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-signature'].join('.');
const session = () => ({ access_token: token(), refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function adapter(fetcher: typeof fetch, cookie = '') {
  const request = new IncomingMessage(new Socket()); request.headers.cookie = cookie;
  const result = new ServerResponse(request);
  return { ...createSupabasePorts(request, result, config, fetcher), result };
}
function setCookies(result: ServerResponse) { return (result.getHeader('Set-Cookie') as string[] | undefined) ?? []; }
function cookieHeader(result: ServerResponse) { return setCookies(result).map(cookie => cookie.split(';')[0]).join('; '); }

test('Google adapter uses identity scopes and server-only PKCE cookies', async () => {
  const ports = adapter(async () => { throw new Error('OAuth initiation must not fetch remote content'); });
  const url = new URL(await ports.auth.startGoogle(`${config.origin}/api/auth/callback`));
  expect(url.origin).toBe(config.url);
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('scopes')?.split(' ').sort()).toEqual(['email','openid','profile']);
  expect(url.searchParams.get('redirect_to')).toBe(`${config.origin}/api/auth/callback`);
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();
  expect(setCookies(ports.result).some(value => value.startsWith('classthread-auth-code-verifier='))).toBe(true);
  for (const value of setCookies(ports.result)) { expect(value).toContain('HttpOnly'); expect(value).toContain('Secure'); expect(value).toContain('SameSite=Lax'); }
});

test('Email provider exchange establishes an HttpOnly session; identity is verified remotely and sign-out clears cookies', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
    if (url.endsWith('/otp')) return response({});
    if (url.endsWith('/verify')) return response(session());
    if (url.endsWith('/user')) return response(user);
    if (url.includes('/logout')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected provider path: ${new URL(url).pathname}`);
  };
  const ports = adapter(fetcher);
  await ports.auth.sendEmailCode(user.email);
  await ports.auth.verifyEmailCode(user.email, '123456');
  expect(calls.find(call => call.url.endsWith('/verify'))?.body).toMatchObject({ email: user.email, token: '123456', type: 'email' });
  expect(setCookies(ports.result).filter(value => value.startsWith('classthread-auth=')).every(value => value.includes('HttpOnly') && value.includes('Secure'))).toBe(true);
  const resumed = adapter(fetcher, cookieHeader(ports.result));
  expect(await resumed.auth.currentUser()).toEqual({ subject: user.id, email: user.email });
  expect(calls.some(call => call.url.endsWith('/user'))).toBe(true);
  await resumed.auth.signOut();
  expect(calls.some(call => call.url.includes('/logout?scope=local'))).toBe(true);
  expect(setCookies(resumed.result).some(value => value.startsWith('classthread-auth=') && value.includes('Max-Age=0'))).toBe(true);
});

test('Provider rejects invalid codes, missing OAuth proof, and unverified cookie identities', async () => {
  const anonymous = adapter(async () => { throw new Error('No remote request needed without a session'); });
  expect(await anonymous.auth.currentUser()).toBeNull();
  const rejected = adapter(async () => response({ code: 'otp_expired', msg: 'Invalid token' }, 403));
  await expect(rejected.auth.verifyEmailCode(user.email, '000000')).rejects.toThrow('invalid or expired');
  expect(setCookies(rejected.result)).toHaveLength(0);
  await expect(rejected.auth.exchangeCode('missing-pkce-proof')).rejects.toThrow('could not be completed');
  const forged = 'classthread-auth=base64-' + Buffer.from(JSON.stringify({ ...session(), expires_at: Math.floor(Date.now()/1000) + 3600 })).toString('base64url');
  expect(await adapter(async () => response({ message: 'Invalid JWT', code: 'bad_jwt' }, 401), forged).auth.currentUser()).toBeNull();
});

test('Expired sessions refresh at the server and issue updated protected cookies', async () => {
  const expired = 'classthread-auth=base64-' + Buffer.from(JSON.stringify({ ...session(), expires_at: 1 })).toString('base64url');
  let refreshed = false;
  const ports = adapter(async input => {
    if (String(input).includes('/token?grant_type=refresh_token')) { refreshed = true; return response(session()); }
    if (String(input).endsWith('/user')) return response(user);
    throw new Error('Unexpected provider call');
  }, expired);
  expect(await ports.auth.currentUser()).toEqual({ subject: user.id, email: user.email });
  expect(refreshed).toBe(true);
  expect(setCookies(ports.result).some(value => value.startsWith('classthread-auth=') && value.includes('HttpOnly'))).toBe(true);
});
