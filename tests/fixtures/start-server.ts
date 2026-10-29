import { createServer } from 'vite';
import { fixtureDatabase } from './database';
import { FIXTURE_ORIGIN, fixturePorts } from './provider';
import { createApiHandler } from '../../server/app';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('The fixture server must never run in production.');
const database = await fixtureDatabase(process.env.CLASSTHREAD_FIXTURE_DB ?? '/tmp/classthread-foundation-fixture');
const api = createApiHandler({ origin: FIXTURE_ORIGIN, configured: true, fixture: true, ports: fixturePorts(database) });
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{ name: 'explicit-test-fixture', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/__fixture/google')) simulatedGoogle(req.url, res); else if (req.url?.startsWith('/api/')) void api(req, res); else next(); }); } }],
});
await server.listen();
console.log('ClassThread DEVELOPMENT FIXTURE: http://127.0.0.1:5174 — use an example.test email and code 123456.');
/** Stand-in for Google's account chooser (fixture only): returns a code to the app's own callback, never anywhere else. */
function simulatedGoogle(path: string, res: import('node:http').ServerResponse) {
  const url = new URL(path, FIXTURE_ORIGIN), back = url.searchParams.get('redirect_to') ?? '', email = url.searchParams.get('email');
  if (back !== `${FIXTURE_ORIGIN}/api/auth/callback`) { res.statusCode = 400; res.end('Bad redirect'); return; }
  if (email) { res.writeHead(303, { Location: `${back}?code=${encodeURIComponent(`fixture-google:${email}`)}` }); res.end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Google</title>
<body style="font:18px system-ui;margin:0;padding:24px;background:#fff;color:#202124"><p style="background:#fde68a;padding:8px 12px;border-radius:8px;font-weight:700">DEVELOPMENT FIXTURE · simulated Google sign-in</p>
<h1 style="font-size:24px">Choose an account</h1><form><input type="hidden" name="redirect_to" value="${back}"><label>Email <input name="email" type="email" required style="font-size:18px;padding:10px;width:100%;box-sizing:border-box"></label>
<p><button style="font-size:18px;padding:12px 20px;background:#1a73e8;color:#fff;border:0;border-radius:6px">Continue</button></p></form></body>`);
}
async function stop() { await server.close(); await database.db.close(); process.exit(0); }
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
