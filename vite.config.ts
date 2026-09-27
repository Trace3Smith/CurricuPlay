import { defineConfig, loadEnv } from 'vite';
import { configuredApi } from './server/config';

export default defineConfig(({ mode }) => {
  const api = configuredApi({ ...process.env, ...loadEnv(mode, process.cwd(), '') });
  return {
    plugins: [{
      name: 'classthread-api',
      configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) void api(req, res); else next(); }); },
      configurePreviewServer(server) { server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) void api(req, res); else next(); }); },
    }],
  };
});
