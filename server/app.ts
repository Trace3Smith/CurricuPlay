import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { assignmentInput, assignmentWithinYear, contextInput, emailInput, idSchema, profileInput, verifyEmailInput, workInput, workStatusInput, yearInput } from '../shared/contracts/foundation';
import { AppError, type RequestPorts } from './ports';
import { resourceService } from './resources/service';

export interface ApiOptions {
  origin: string;
  configured: boolean;
  fixture?: boolean;
  ports: (req: IncomingMessage, res: ServerResponse) => RequestPorts;
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage, limit = 32768) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'Send JSON data.');
  // Vercel can provide an already-parsed body; the local Node adapter streams it.
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed !== undefined) {
    const serialized = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    if (Buffer.byteLength(serialized) > limit) throw new AppError(413, 'This request is too large.');
    try { return JSON.parse(serialized) as unknown; } catch { throw new AppError(400, 'Invalid JSON.'); }
  }
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new AppError(413, 'This request is too large.');
    chunks.push(bytes);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw || '{}') as unknown; } catch { throw new AppError(400, 'Invalid JSON.'); }
}

export function createApiHandler(options: ApiOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const url = new URL(req.url ?? '/', options.origin);
    const method = req.method ?? 'GET';
    const route = url.pathname.replace(/\/$/, '');
    try {
      if (!['GET', 'POST', 'PATCH'].includes(method)) throw new AppError(405, 'Method not allowed.');
      // A same-origin JSON request is required even for login: prevent login CSRF.
      if (method !== 'GET' && req.headers.origin !== options.origin) throw new AppError(403, 'Request origin is not permitted.');
      if (!options.configured) {
        if (route === '/api/session' && method === 'GET') return json(res, 200, { configured: false, authenticated: false, fixture: false });
        throw new AppError(503, 'ClassThread sign-in is not configured yet. Games remain available in this browser.');
      }
      const ports = options.ports(req, res);
      const { auth, repository } = ports;
      if (route === '/api/session' && method === 'GET') {
        const user = await auth.currentUser();
        return json(res, 200, { configured: true, authenticated: !!user, fixture: !!options.fixture, ...(user ? { email: user.email } : {}) });
      }
      if (route === '/api/auth/google' && method === 'POST') {
        await body(req);
        return json(res, 200, { url: await auth.startGoogle(`${options.origin}/api/auth/callback`) });
      }
      if (route === '/api/auth/email' && method === 'POST') {
        await auth.sendEmailCode(emailInput.parse(await body(req)).email);
        return json(res, 200, { message: 'Check your email for a sign-in code.' });
      }
      if (route === '/api/auth/verify' && method === 'POST') {
        const value = verifyEmailInput.parse(await body(req));
        await auth.verifyEmailCode(value.email, value.token);
        await repository.bootstrap();
        return json(res, 200, { ok: true });
      }
      if (route === '/api/auth/callback' && method === 'GET') {
        try {
          const code = z.string().min(1).max(4096).parse(url.searchParams.get('code'));
          await auth.exchangeCode(code);
          await repository.bootstrap();
          res.writeHead(303, { Location: '/classroom' }); res.end();
        } catch { res.writeHead(303, { Location: '/sign-in?error=callback' }); res.end(); }
        return;
      }
      if (route === '/api/auth/sign-out' && method === 'POST') {
        await body(req); await auth.signOut(); return json(res, 200, { ok: true });
      }
      const identity = await auth.currentUser();
      if (!identity) throw new AppError(401, 'Please sign in to access your classroom.');
      await repository.bootstrap();
      const data = await repository.read(identity);
      if (route === '/api/resources' || route.startsWith('/api/resources/')) {
        const service = resourceService(ports, data);
        const parts = route.slice('/api/resources'.length).split('/').filter(Boolean);
        const id = parts.length ? idSchema.parse(parts[0]) : undefined;
        if (!id && method === 'GET') return json(res, 200, await service.list());
        if (!id && method === 'POST') return json(res, 201, { id: await service.create(await body(req, 2900000)) });
        if (id && parts.length === 1 && method === 'GET') return json(res, 200, await service.detail(id));
        if (id && parts.length === 1 && method === 'PATCH') return json(res, 200, { id: await service.edit(id, await body(req)) });
        if (id && parts[1] === 'versions' && parts.length === 2 && method === 'POST') return json(res, 201, { id: await service.addVersion(id, await body(req, 2900000)) });
        if (id && parts[1] === 'versions' && parts.length === 4 && method === 'GET') {
          const versionId = idSchema.parse(parts[2]);
          if (parts[3] === 'preview') return json(res, 200, await service.preview(id, versionId));
          if (parts[3] === 'download') {
            const { record, bytes } = await service.download(id, versionId);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="curriculum-original"; filename*=UTF-8''${encodeURIComponent(record.fileName!).replace(/'/g, '%27')}`);
            res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
            res.end(Buffer.from(bytes)); return;
          }
        }
        if (id && parts[1] === 'curriculum' && parts.length === 2 && method === 'POST') return json(res, 201, { id: await service.propose(id, await body(req)) });
        if (id && parts[1] === 'curriculum' && parts.length === 4 && method === 'POST') {
          const curriculumId = idSchema.parse(parts[2]);
          if (parts[3] === 'review') { await service.review(id, curriculumId, await body(req, 200000)); return json(res, 200, { ok: true }); }
          if (parts[3] === 'activate') return json(res, 201, { id: await service.activate(id, curriculumId, await body(req)) });
        }
        throw new AppError(404, 'Resource route not found.');
      }
      if (route === '/api/foundation' && method === 'GET') return json(res, 200, data);
      if (route === '/api/profile' && method === 'PATCH') {
        await repository.updateProfile(data.user.id, profileInput.parse(await body(req)));
      } else if (route === '/api/context' && method === 'PATCH') {
        const value = contextInput.parse(await body(req));
        if (value.schoolYearId && !data.schoolYears.some(year => year.id === value.schoolYearId)) throw new AppError(403, 'School year is unavailable.');
        if (value.assignmentId && !data.assignments.some(assignment => assignment.id === value.assignmentId && assignment.schoolYearId === value.schoolYearId)) throw new AppError(403, 'Assignment is unavailable for that school year.');
        await repository.selectContext(data.user.id, value);
      } else if (route === '/api/school-years' && method === 'POST') {
        await repository.createYear(data.workspace.id, yearInput.parse(await body(req)));
      } else if (route === '/api/assignments' && method === 'POST') {
        const value = assignmentInput.parse(await body(req));
        const year = data.schoolYears.find(year => year.id === value.schoolYearId);
        if (!year) throw new AppError(403, 'School year is unavailable.');
        if (!assignmentWithinYear(value, year)) throw new AppError(400, 'Assignment dates must fall within its school year.');
        await repository.createAssignment(data.workspace.id, value);
      } else if (route === '/api/work-items' && method === 'POST') {
        const value = workInput.parse(await body(req));
        if (value.assignmentId && !data.assignments.some(assignment => assignment.id === value.assignmentId)) throw new AppError(403, 'Assignment is unavailable.');
        await repository.createWork(data.workspace.id, data.user.id, value);
      } else if (route.startsWith('/api/work-items/') && method === 'PATCH') {
        const id = idSchema.parse(route.slice('/api/work-items/'.length));
        if (!data.workItems.some(item => item.id === id)) throw new AppError(404, 'Work item is unavailable.');
        await repository.updateWork(data.workspace.id, id, workStatusInput.parse(await body(req)));
      } else throw new AppError(404, 'Route not found.');
      json(res, 200, { ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return json(res, 400, { error: error.issues[0]?.message ?? 'Check the supplied fields.' });
      if (error instanceof AppError) return json(res, error.status, { error: error.message });
      // Do not log request bodies, cookies, OAuth codes, or provider error payloads.
      console.error('ClassThread API request failed', { route, method, type: error instanceof Error ? error.name : 'unknown' });
      json(res, 500, { error: 'The request could not be completed. Please try again.' });
    }
  };
}
