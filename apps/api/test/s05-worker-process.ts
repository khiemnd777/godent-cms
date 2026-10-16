import { lstat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LeadNotificationWorker } from '../src/worker/lead-worker';
import { LocalLeadCapture, type LeadCaptureMessage } from '../src/worker/local-capture';

const [tenant, directory, mode] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/.test(tenant ?? '') || !directory?.startsWith('/private/tmp/gcms-s05-worker-') || resolve(directory) !== directory ||
  !['hold', 'crash_before', 'crash_after'].includes(mode)) throw new Error('Explicit owned worker fault fixture required');
const metadata = await lstat(directory); if (!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o700) throw new Error('Unsafe fixture directory');
const capture = new LocalLeadCapture(join(directory, 'capture'));
const worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL ?? '', { async capture(message: LeadCaptureMessage) {
  await writeFile(join(directory, 'started.json'), JSON.stringify({ deliveryId: message.deliveryId }), { flag: 'wx', mode: 0o600 });
  if (mode === 'crash_before') process.exit(31);
  if (mode === 'hold') {
    const deadline = Date.now() + 60000;
    while (!await Bun.file(join(directory, 'release')).exists()) { if (Date.now() > deadline) throw new Error('Owned unsettled I/O fixture deadline'); await Bun.sleep(25); }
  }
  await capture.capture(message);
  if (mode === 'crash_after') process.exit(32);
} });
try { console.info(JSON.stringify(await worker.runOnce(tenant))); } finally { await worker.close(); }
