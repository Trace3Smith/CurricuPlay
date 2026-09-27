import { createServer } from 'vite';
import { fixtureDatabase } from './database';
import { fixturePorts } from './provider';
import { createApiHandler } from '../../server/app';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('The fixture server must never run in production.');
const database = await fixtureDatabase(process.env.CLASSTHREAD_FIXTURE_DB ?? '/tmp/classthread-foundation-fixture');
const api = createApiHandler({ origin: 'http://127.0.0.1:5174', configured: true, fixture: true, ports: fixturePorts(database) });
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{ name: 'explicit-test-fixture', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) void api(req, res); else next(); }); } }],
});
await server.listen();
console.log('ClassThread DEVELOPMENT FIXTURE: http://127.0.0.1:5174 — use an example.test email and code 123456.');
async function stop() { await server.close(); await database.db.close(); process.exit(0); }
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
