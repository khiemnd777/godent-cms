import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RetentionWorker } from '../src/worker/retention-worker';
import { RetentionCapture } from '../src/worker/retention-capture';
async function main() {
  if (Object.keys(process.env).some(k => /DATABASE_URL$/.test(k) && k !== 'S06_WORKER_DATABASE_URL')) throw new Error('Isolated worker required');
  const [tenant, directory, mode] = process.argv.slice(2);
  if (!tenant || !directory?.startsWith('/private/tmp/gcms-s06-process-') || !['before', 'after'].includes(mode)) throw new Error('Owned process scope required');
  const capture = new RetentionCapture(join(directory, 'capture'));
  const w = new RetentionWorker(process.env.S06_WORKER_DATABASE_URL ?? '', { async capture(message) {
    await writeFile(join(directory, 'started.json'), JSON.stringify({ deliveryId: message.deliveryId }), { flag: 'wx', mode: 0o600 });
    if (mode === 'before') process.exit(31);
    await capture.capture(message); process.exit(32);
  } });
  try { await w.runOnce(tenant); } finally { await w.close(); }
}
void main().catch(() => { console.error('Owned S06 fault process failed; redacted.'); process.exitCode = 1; });
