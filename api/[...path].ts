import type { IncomingMessage, ServerResponse } from 'node:http';
import { configuredApi } from '../server/config.js';

/** Vercel adapter only. The domain and API handler also run through Vite locally. */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return configuredApi(process.env)(req, res);
}
