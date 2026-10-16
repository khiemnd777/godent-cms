import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export function selectWorkerEnvironment(privateConfig: Record<string, string>, source: Record<string, string | undefined>) {
  const selected: Record<string, string> = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'NODE_ENV']) if (source[key]) selected[key] = source[key]!;
  selected.S05_WORKER_DATABASE_URL = validateDatabaseUrl(privateConfig.S05_WORKER_DATABASE_URL, 'gcms_s05_worker');
  return selected;
}
async function main() {
  if (process.cwd() !== resolve(import.meta.dir, '..') || Bun.version !== '1.4.3' || process.argv.length !== 5 || process.argv[2] !== '--tenant' || process.argv[4] !== '--once') throw new Error('Explicit bounded local S05 worker required');
  const path = resolve('.local/s05.env'), metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o600) throw new Error('Unsafe worker private config');
  const config = Object.fromEntries((await readFile(path, 'utf8')).trim().split('\n').map(line => { const at = line.indexOf('='); if (at < 1) throw new Error('Invalid worker config'); return [line.slice(0, at), line.slice(at + 1)]; }));
  if (Object.keys(config).some(key => key !== 'S05_WORKER_DATABASE_URL')) throw new Error('Unexpected worker private config');
  const fixture = JSON.parse(await readFile('.local/s05-fixtures.json', 'utf8')) as { tenantId: string; tenantSlug: string };
  if (fixture.tenantId !== process.argv[3] || !/^[a-f0-9-]{36}$/.test(fixture.tenantId) || !fixture.tenantSlug.startsWith('s05-ui-')) throw new Error('Operator-selected S05 tenant required');
  const child = Bun.spawn([process.execPath, '--no-env-file', 'apps/api/dist/worker/main.js', '--tenant', fixture.tenantId, '--once'],
    { env: selectWorkerEnvironment(config, process.env), stdout: 'inherit', stderr: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
  // Await graceful settlement. No timeout forces a new attempt while capture may still run.
  process.exitCode = await child.exited;
}
if (import.meta.main) void main().catch(() => { console.error('S05 worker launcher failed; details redacted.'); process.exitCode = 1; });
