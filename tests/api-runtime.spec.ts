import { test, expect } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/*
 * Vercel compiles each serverless source file on its own and runs the result in plain
 * Node ESM ("type": "module"). Unlike Vite and tsx, plain Node does not guess file
 * extensions, so an import such as '../server/config' crashes the whole API at load
 * time (production returned 500 FUNCTION_INVOCATION_FAILED for every /api request).
 * These checks reproduce that runtime so the regression cannot return unnoticed.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverFiles = execFileSync('git', ['ls-files', 'api/*.ts', 'server/*.ts', 'server/**/*.ts', 'shared/*.ts', 'shared/**/*.ts'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const relativeImport = /\bfrom\s+'(\.{1,2}\/[^']+)'/g;

test('server-side relative imports name the runtime .js file explicitly', () => {
  const missing = serverFiles.flatMap(file => [...readFileSync(join(root, file), 'utf8').matchAll(relativeImport)]
    .map(match => match[1]).filter(spec => !/\.(js|json)$/.test(spec)).map(spec => `${file}: ${spec}`));
  expect(missing).toEqual([]);
});

test('the deployed API loads in plain Node ESM and reports unconfigured sign-in without crashing', () => {
  const out = mkdtempSync(join(tmpdir(), 'classthread-api-runtime-'));
  try {
    for (const file of serverFiles) {
      const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false, isolatedModules: true },
      });
      const target = join(out, file.replace(/\.ts$/, '.js'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, outputText);
    }
    writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'module' }));
    symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'), 'dir');
    const probe = `
      const { default: handler } = await import('./api/[...path].js');
      const { PassThrough } = await import('node:stream');
      const req = Object.assign(new PassThrough(), { url: '/api/session', method: 'GET', headers: {} });
      const res = { statusCode: 200, setHeader() {}, writeHead(status) { this.statusCode = status; return this; },
        end(body) { process.stdout.write(JSON.stringify({ status: this.statusCode, body: JSON.parse(String(body)) })); } };
      await handler(req, res);`;
    // A clean environment like the current production project: Vercel present, no ClassThread settings.
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: out, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', VERCEL: '1', NODE_ENV: 'production' } });
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toEqual({ status: 200, body: { configured: false, authenticated: false, fixture: false } });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
