import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditExpiryTenant, assertAuditWorkerManifest } from '../apps/api/src/worker/audit-expiry-environment';
import { selectM2WorkerEnvironment } from './start-m2-worker';
async function privateText(path: string) {
  const meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || (meta.mode & 0o777) !== 0o600 || meta.uid !== process.getuid?.() || meta.size > 1048576) throw new Error('Unsafe private audit worker input');
  return readFile(path, 'utf8');
}
async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Pinned local audit invocation required');
  const args = process.argv.slice(2), tenant = auditExpiryTenant(args);
  const directory = await lstat('.local');
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid?.()) throw new Error('Unsafe private audit directory');
  const manifest: unknown = JSON.parse(await privateText('.local/audit-expiry-worker.json')); assertAuditWorkerManifest(manifest, tenant);
  const config = Object.fromEntries((await privateText('.local/m2.env')).trim().split('\n').map(line => { const at = line.indexOf('='); if (at < 1) throw new Error('Malformed scoped configuration'); return [line.slice(0, at), line.slice(at + 1)]; }));
  const env = selectM2WorkerEnvironment('s06', config, process.env);
  const child = Bun.spawn([process.execPath, '--no-env-file', 'apps/api/dist/worker/audit-expiry-main.js', ...args], { env, stdout: 'inherit', stderr: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
  process.exitCode = await child.exited;
}
if (import.meta.main) void main().catch(() => { console.error('Audit worker launch refused; details redacted.'); process.exitCode = 1; });
