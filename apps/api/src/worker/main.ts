import { readFile } from 'node:fs/promises';
import { LeadNotificationWorker } from './lead-worker';

async function main() {
// This entry receives a sanitized worker-only environment from the root launcher.
if (Object.keys(process.env).some(key => /DATABASE_URL$/.test(key) && key !== 'S05_WORKER_DATABASE_URL') || process.env.BETTER_AUTH_SECRET || process.env.S04_HMAC_SECRET) throw new Error('Worker credential isolation required');
if (Bun.version !== '1.4.3' || process.argv.length !== 5 || process.argv[2] !== '--tenant' || process.argv[4] !== '--once') throw new Error('Explicit bounded worker invocation required');
const tenant = process.argv[3], fixture = JSON.parse(await readFile('.local/s05-fixtures.json', 'utf8')) as { tenantId: string; tenantSlug: string };
if (fixture.tenantId !== tenant || !fixture.tenantSlug.startsWith('s05-ui-')) throw new Error('Operator-selected S05 fixture required');
const worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL ?? '');
// Signals request shutdown. They do not claim cancellation of an already started capture.
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { stopping = true; });
try {
  const result = await worker.runOnce(tenant);
  console.info(JSON.stringify({ status: 'completed', runtime: 'bun', version: Bun.version, transport: 'local_capture', ...result, stopping }));
} catch { console.error('S05 worker failed; details redacted.'); process.exitCode = 1; }
finally { await worker.close(); }
}
void main().catch(() => { console.error('S05 worker initialization failed; details redacted.'); process.exitCode = 1; });
