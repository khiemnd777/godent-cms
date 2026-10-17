import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { S07_ROUTES, type MediaAsset, type MediaPage } from '../apps/api/src/contracts/s07';
import { DockerMediaProcessor } from '../apps/api/src/media/processor';
import { MediaStorage, readMediaStorageConfig } from '../apps/api/src/media/storage';
import { MediaWorker } from '../apps/api/src/worker/media-worker';
import { privateLacVanText, readLacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';
import { selectM2WorkerEnvironment } from './start-m2-worker';

const PATH = '.local/lacvan-media.json', LOCK = '.local/lacvan-media.lock', OWNER = 'GCMS-LACVAN-MEDIA-v1';
interface Asset { key: string; path: string; sha256: string; operationId: string; id: string | null; revision: number | null; processed: boolean }
interface Manifest { owner: typeof OWNER; fixtureRun: string; tenantId: string; assets: Asset[]; claims: { assetId: string; jobId: string; workerId: string; fence: number; status: string }[] }
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main() {
  check(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).join(' ') === '--local-lacvan --upload', 'Explicit pinned clinic media operation required');
  const fixture = await readLacVanFixtures(); check(fixture.status === 'complete', 'Complete clinic ownership required');
  const source = JSON.parse(await readFile('docs/evidence/lacvan/assets.json', 'utf8')) as { task: string; assets: { id: string; path: string; sha256: string; bytes: number }[] };
  check(source.task === 'GCMS-LACVAN-001' && source.assets.length === 24 && new Set(source.assets.map(a => a.id)).size === 24, 'Exact original asset set required');
  for (const a of source.assets) {
    check(/^assets\/lacvan\/[a-z-]+\.png$/.test(a.path) && /^[a-f0-9]{64}$/.test(a.sha256) && a.bytes > 0 && a.bytes <= 5 * 1024 * 1024, 'Invalid original asset manifest');
    const stat = await lstat(a.path); check(stat.isFile() && !stat.isSymbolicLink() && stat.size === a.bytes && digest(await readFile(a.path)) === a.sha256, 'Original asset changed');
  }
  if (!await Bun.file(PATH).exists()) {
    const planned: Manifest = { owner: OWNER, fixtureRun: fixture.runId, tenantId: fixture.tenant.id, assets: source.assets.map(a => ({ key: a.id, path: a.path, sha256: a.sha256, operationId: randomUUID(), id: null, revision: null, processed: false })), claims: [] };
    await writeFile(PATH, JSON.stringify(planned, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  const manifest = JSON.parse(await privateLacVanText(PATH)) as Manifest;
  check(manifest.owner === OWNER && manifest.fixtureRun === fixture.runId && manifest.tenantId === fixture.tenant.id && manifest.assets.length === source.assets.length, 'Clinic media ownership mismatch');
  for (const a of manifest.assets) check(source.assets.some(s => s.id === a.key && s.path === a.path && s.sha256 === a.sha256) && /^[a-f0-9-]{36}$/.test(a.operationId) && (a.id === null || /^[a-f0-9-]{36}$/.test(a.id)), 'Clinic media journal mismatch');
  const lockValue = JSON.stringify({ owner: OWNER, fixtureRun: fixture.runId, pid: process.pid });
  await writeFile(LOCK, lockValue, { flag: 'wx', mode: 0o600 });
  async function store() {
    const old = JSON.parse(await privateLacVanText(PATH)) as Manifest;
    check(old.owner === OWNER && old.fixtureRun === manifest.fixtureRun && old.tenantId === manifest.tenantId, 'Clinic media ownership changed');
    const temp = `.local/lacvan-media-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, PATH);
  }
  let worker: MediaWorker | undefined;
  try {
    const session = new LacVanHttp(fixture.tenant.id, fixture.tenant.slug, fixture.identities.find(i => i.label === 'Owner')!); await session.login();
    for (const asset of manifest.assets) if (!asset.id) {
      const form = new FormData(); form.set('operationId', asset.operationId); form.set('materialKind', 'ordinary');
      form.set('file', new File([new Uint8Array(await readFile(asset.path))], asset.key + '.png', { type: 'image/png' }));
      const uploaded = await session.command<MediaAsset>(S07_ROUTES.media(fixture.tenant.id), 'POST', form);
      check(uploaded.tenantId === fixture.tenant.id && /^[a-f0-9-]{36}$/.test(uploaded.id), 'Clinic media upload scope mismatch');
      asset.id = uploaded.id; asset.revision = uploaded.revision; await store();
    }
    const allowed = new Set(manifest.assets.map(a => a.id)); let cursor: string | null = null; const seen = new Set<string>();
    do {
      const page: MediaPage = await session.get(S07_ROUTES.media(fixture.tenant.id) + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
      check(page.items.every(a => allowed.has(a.id)), 'Unowned clinic media prevents worker dispatch');
      cursor = page.nextCursor; if (cursor) { check(!seen.has(cursor) && seen.size < 10, 'Invalid bounded media cursor'); seen.add(cursor); }
    } while (cursor);
    const config = Object.fromEntries((await privateLacVanText('.local/m2.env')).trim().split('\n').map(line => { const at = line.indexOf('='); check(at > 0, 'Invalid media worker input'); return [line.slice(0, at), line.slice(at + 1)]; }));
    const environment = selectM2WorkerEnvironment('s07', config, process.env);
    worker = new MediaWorker(environment.S07_WORKER_DATABASE_URL, new MediaStorage(readMediaStorageConfig(environment)), new DockerMediaProcessor(environment.S07_DECODER_IMAGE)); await worker.verifyRole();
    for (let i = 0; i < manifest.assets.length; i++) {
      const current = await Promise.all(manifest.assets.map(a => session.get<MediaAsset>(S07_ROUTES.asset(fixture.tenant.id, a.id!))));
      if (current.every(a => a.state === 'ready')) break;
      const claim = await worker.claim(fixture.tenant.id); check(claim && claim.kind === 'process' && claim.tenantId === fixture.tenant.id && allowed.has(claim.assetId), 'Owned media claim unavailable');
      const journal = { assetId: claim.assetId, jobId: claim.id, workerId: worker.workerId, fence: claim.fence, status: 'claimed' }; manifest.claims.push(journal); await store();
      journal.status = await worker.process(claim); await store(); check(journal.status === 'completed', 'Clinic media processing incomplete');
      console.info(JSON.stringify({ phase: 'clinic-media-process', completed: manifest.claims.filter(c => c.status === 'completed').length, total: manifest.assets.length }));
    }
    for (const asset of manifest.assets) {
      const current = await session.get<MediaAsset>(S07_ROUTES.asset(fixture.tenant.id, asset.id!));
      check(current.tenantId === fixture.tenant.id && current.state === 'ready' && current.materialKind === 'ordinary', 'Clinic media not ready');
      asset.processed = true; asset.revision = current.revision; await store();
    }
    const result = { status: 'PASS', phase: 'clinic-media-ready', assets: manifest.assets.length, processed: manifest.assets.filter(a => a.processed).length, otherTenantsClaimed: 0, recordedAt: new Date().toISOString() };
    await writeFile(`docs/evidence/lacvan/media-${Date.now()}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(result));
  } finally {
    if (worker) await worker.close();
    check(await privateLacVanText(LOCK) === lockValue, 'Clinic media lock changed'); await unlink(LOCK);
  }
}
if (import.meta.main) void main().catch(async error => {
  await writeFile(`.local/lacvan-media-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error('Clinic media failed/refused; private diagnostic retained.'); process.exitCode = 1;
});
