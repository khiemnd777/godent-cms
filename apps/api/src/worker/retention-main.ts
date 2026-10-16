import { readFile } from 'node:fs/promises';
import { RetentionWorker } from './retention-worker';
async function main() {
  if (Object.keys(process.env).some(k => /DATABASE_URL$/.test(k) && k !== 'S06_WORKER_DATABASE_URL') || process.env.BETTER_AUTH_SECRET || process.env.S04_HMAC_SECRET) throw new Error('Worker credential isolation required');
  if (Bun.version !== '1.4.3' || process.argv.length !== 5 || process.argv[2] !== '--tenant' || process.argv[4] !== '--once') throw new Error('Explicit bounded worker invocation required');
  const tenant = process.argv[3], manifest = JSON.parse(await readFile('.local/m2-fixtures.json', 'utf8')) as { retentionTenantIds?: string[] };
  if (!manifest.retentionTenantIds?.includes(tenant)) throw new Error('Operator-selected M2 fixture required');
  const worker = new RetentionWorker(process.env.S06_WORKER_DATABASE_URL ?? '');
  try { console.info(JSON.stringify({ status: 'completed', transport: 'local_capture', ...await worker.runOnce(tenant) })); }
  catch { console.error('S06 retention worker failed; details redacted.'); process.exitCode = 1; }
  finally { await worker.close(); }
}
void main().catch(() => { console.error('S06 retention worker initialization failed; details redacted.'); process.exitCode = 1; });
