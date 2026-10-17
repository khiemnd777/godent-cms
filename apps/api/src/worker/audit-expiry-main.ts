import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditExpiryTenant, assertAuditWorkerEnvironment, assertAuditWorkerManifest } from './audit-expiry-environment';
import { RetentionWorker } from './retention-worker';
async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(__dirname, '../../../..')) throw new Error('Pinned audit worker runtime required');
  assertAuditWorkerEnvironment(process.env);
  const tenant = auditExpiryTenant(process.argv.slice(2));
  const directory = await lstat('.local');
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid?.()) throw new Error('Unsafe audit scope directory');
  const path = '.local/audit-expiry-worker.json', meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || (meta.mode & 0o777) !== 0o600 || meta.uid !== process.getuid?.() || meta.size > 16384) throw new Error('Unsafe private audit scope');
  const manifest: unknown = JSON.parse(await readFile(path, 'utf8')); assertAuditWorkerManifest(manifest, tenant);
  const worker = new RetentionWorker(process.env.S06_WORKER_DATABASE_URL ?? '');
  try {
    await worker.verifyRole();
    const audit = await worker.expireAudit(tenant);
    console.info(JSON.stringify({ status: 'completed', mode: 'audit-only', tenantId: tenant, audit }));
  } finally { await worker.close(); }
}
void main().catch(() => { console.error('Audit-only expiry denied/failed; details redacted.'); process.exitCode = 1; });
