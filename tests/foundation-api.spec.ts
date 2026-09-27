import { test, expect } from '@playwright/test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createApiHandler } from '../server/app';
import { configuredApi } from '../server/config';
import type { RequestPorts } from '../server/ports';
import { assignmentInput, assignmentWithinYear, contextInput, profileInput, workInput } from '../shared/contracts/foundation';
import { randomUUID } from 'node:crypto';

const origin = 'https://classroom.example.test';
function request(method: string, path: string, parsed?: unknown) {
  const req = new IncomingMessage(new Socket()) as IncomingMessage & { body?: unknown };
  req.method = method; req.url = path; req.headers = { origin, 'content-type': 'application/json' };
  req.body = parsed;
  const res = new ServerResponse(req);
  let output = '';
  res.end = ((value?: string) => { output = value ?? ''; return res; }) as typeof res.end;
  return { req, res, output: () => JSON.parse(output) };
}

test('The Vercel parsed-body adapter retains JSON validation, size limits and origin protection', async () => {
  const emails: string[] = [];
  const handler = createApiHandler({ origin, configured: true, ports: () => ({ auth: { sendEmailCode: async (email: string) => { emails.push(email); } } } as RequestPorts) });
  const valid = request('POST', '/api/auth/email', { email: 'teacher@example.test' });
  await handler(valid.req, valid.res); expect(valid.res.statusCode).toBe(200); expect(emails).toEqual(['teacher@example.test']);
  for (const [body, status] of [[{ email: 'invalid' }, 400], ['{bad-json', 400], [{ email: 'a'.repeat(33000) }, 413]] as const) {
    const invalid = request('POST', '/api/auth/email', body); await handler(invalid.req, invalid.res); expect(invalid.res.statusCode).toBe(status);
  }
  const crossOrigin = request('POST', '/api/auth/email', { email: 'teacher@example.test' }); crossOrigin.req.headers.origin = 'https://other.example.test';
  await handler(crossOrigin.req, crossOrigin.res); expect(crossOrigin.res.statusCode).toBe(403); expect(emails).toHaveLength(1);
});

test('Unconfigured production fails closed and exposes no teacher data or development authentication', async () => {
  const handler = configuredApi({ NODE_ENV: 'production' });
  const session = request('GET', '/api/session'); await handler(session.req, session.res);
  expect(session.output()).toEqual({ configured: false, authenticated: false, fixture: false });
  const privateData = request('GET', '/api/foundation'); await handler(privateData.req, privateData.res); expect(privateData.res.statusCode).toBe(503);
  expect(privateData.res.getHeader('Cache-Control')).toBe('private, no-store');
});

test('Generic teacher contracts accept varied roles and require coherent dates and context', () => {
  const year = { id: randomUUID(), workspaceId: randomUUID(), name: '2026–27', startsOn: '2026-08-01', endsOn: '2027-07-31' };
  for (const [subject, teachingRole, grades, jurisdiction] of [['Physical education', 'PE', ['K','mixed ages'], 'Georgia'], ['Chemistry', 'CTE', ['11','12'], 'Texas'], ['Music', 'Intervention', ['adult'], 'Ontario']] as const) {
    const assignment = assignmentInput.parse({ schoolYearId: year.id, title: subject, subject, teachingRole, grades, jurisdiction, district: '', school: '', course: '', schedule: '', startsOn: year.startsOn, endsOn: year.endsOn, isActive: true });
    expect(assignmentWithinYear(assignment, year)).toBe(true);
    expect(assignmentWithinYear({ ...assignment, startsOn: '2025-08-01' }, year)).toBe(false);
    expect(assignmentInput.safeParse({ ...assignment, grades: ['11','11'] }).success).toBe(false);
  }
  expect(contextInput.safeParse({ schoolYearId: null, assignmentId: randomUUID(), revision: 1 }).success).toBe(false);
  expect(profileInput.safeParse({ displayName: 'Teacher', timezone: 'invalid/timezone', revision: 1 }).success).toBe(false);
  expect(workInput.safeParse({ title: 'Task', description: '', dueOn: null, assignmentId: null, priority: 'normal', action: 'send-email' }).success).toBe(false);
});
