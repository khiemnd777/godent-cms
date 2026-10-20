import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { M4_ROUTES, type M4Resolution, type M4Variant } from '../apps/api/src/contracts/m4';
import { S07_ROUTES, type MediaAsset } from '../apps/api/src/contracts/s07';
import { privateDentalGoText, readDentalGoFixtures } from './dental-go-fixtures';
import { DentalGoHttp } from './dental-go-http';
import type { DentalGoEntry } from './dental-go-content';

function check(v: unknown, message: string): asserts v { if (!v) throw new Error(message); }
async function main() {
  check(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).join(' ') === '--local-dental-go', 'Explicit local verification required');
  const f = await readDentalGoFixtures(), actor = f.identities.find(i => i.label === 'Owner')!;
  const j = JSON.parse(await privateDentalGoText('.local/dental-go-seed.json')) as { fixtureRun: string; tenantId: string; complete: boolean; entries: DentalGoEntry[] };
  check(j.fixtureRun === f.runId && j.tenantId === f.tenant.id && j.complete, 'Owned seed incomplete');
  const http = new DentalGoHttp(f.tenant.id, f.tenant.slug, actor); await http.login();
  const media = JSON.parse(await privateDentalGoText('.local/dental-go-media.json')) as { tenantId: string; fixtureRun: string; assets: { id: string; revision: number; processed: boolean }[] };
  check(media.tenantId === f.tenant.id && media.fixtureRun === f.runId && media.assets.length === 10, 'Media ownership mismatch');
  for (const a of media.assets) { const current = await http.get<MediaAsset>(S07_ROUTES.asset(f.tenant.id, a.id)); check(a.processed && current.state === 'ready' && current.tenantId === f.tenant.id, 'Media not ready'); }
  const pages: { key: string; locale: string; status: number; publicationId: string }[] = [], paths = new Set<string>();
  for (const locale of ['vi', 'en'] as const) {
    const config = await http.get<M4Variant>(M4_ROUTES.config(f.tenant.id, locale)); check(config.activePublication && config.content && 'name' in config.content && config.content.name === 'Dental GO+', 'Wrong live brand');
    for (const e of j.entries) {
      const draft = await http.get<M4Variant>(M4_ROUTES.resource(f.tenant.id, e.kind, e.id, locale));
      check(draft.tenantId === f.tenant.id && draft.activePublication && draft.publishedVersion === draft.version, 'Variant not fully published');
      const resolution = await http.get<M4Resolution>(M4_ROUTES.publicPage(f.tenant.slug, locale, e.kind, e.slug));
      check(resolution.resolution === 'page' && resolution.actualLocale === locale && resolution.page.id === e.id && resolution.page.publicationId === draft.publicationId, 'Public page mismatch');
      const page = resolution.page, url = new URL(page.canonicalUrl);
      check(url.origin === 'http://localhost:5892' && url.pathname.startsWith('/dental-go-plus') && !url.search && !url.hash, 'Wrong public origin');
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) }), html = await response.text();
      check(response.status === 200 && html.includes('Dental GO+') && !html.includes('Nha khoa Lạc Vân'), 'SSR page mismatch');
      pages.push({ key: e.key, locale, status: response.status, publicationId: page.publicationId });
      const visit = (v: unknown) => { if (!v || typeof v !== 'object') return; if ('path' in v && typeof v.path === 'string' && v.path.startsWith('/api/public/builder-media/')) paths.add(v.path); for (const child of Object.values(v)) visit(child); };
      visit(page);
    }
  }
  check(paths.size > 0, 'No builder media gateways were inspected');
  for (const path of paths) { check(path.startsWith(`/api/public/builder-media/${f.tenant.id}/`), 'Cross-tenant image reference'); const r = await fetch('http://127.0.0.1:5890' + path, { signal: AbortSignal.timeout(20000) }); check(r.status === 200 && r.headers.get('content-type')?.startsWith('image/'), 'Public image unavailable'); await r.arrayBuffer(); }
  const dbUrl = new URL(process.env.DATABASE_URL!); check(dbUrl.hostname === '127.0.0.1' && dbUrl.port === '5888' && dbUrl.username === 'gcms_local', 'Wrong local database');
  const db = new SQL(dbUrl.toString(), { max: 1, connection: { default_transaction_read_only: 'on' } });
  let other: string;
  try { const rows = await db`SELECT id FROM gcms_s02.tenant WHERE id<>${f.tenant.id} AND status='active' ORDER BY id LIMIT 1`; check(rows.length === 1, 'Existing tenant needed for authorization probe'); other = String(rows[0].id); }
  finally { await db.close(); }
  // Exercise the backend authorization boundary directly; do not print responses or cookies.
  const signed = await fetch('http://127.0.0.1:5890/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'http://127.0.0.1:5891', 'content-type': 'application/json' }, body: JSON.stringify({ email: actor.email, password: actor.password, rememberMe: false }) });
  check(signed.status === 200, 'Authorization probe sign-in failed'); const cookie = signed.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  const denied = await fetch('http://127.0.0.1:5890' + M4_ROUTES.config(other, 'vi'), { headers: { cookie, origin: 'http://127.0.0.1:5891' } });
  check(denied.status === 403 || denied.status === 404, 'Cross-tenant backend access not denied');
  const before = await http.get<M4Variant>(M4_ROUTES.resource(f.tenant.id, 'home', j.entries.find(e => e.key === 'home')!.id, 'vi'));
  const replay = Bun.spawnSync([process.execPath, '--env-file=.env', 'scripts/dental-go-seed.ts', '--local-dental-go', '--seed'], { stdout: 'pipe', stderr: 'pipe' });
  check(replay.exitCode === 0, 'Completed seed replay failed');
  const after = await http.get<M4Variant>(M4_ROUTES.resource(f.tenant.id, 'home', before.id, 'vi'));
  check(JSON.stringify(before) === JSON.stringify(after), 'Completed seed reset CMS changes');
  const files = Bun.spawnSync(['rg', '--files', 'apps', 'scripts', 'docs', 'AGENTS.md'], { stdout: 'pipe', stderr: 'pipe' }); check(files.exitCode === 0, 'Source inventory unavailable');
  let scanned = 0;
  for (const path of new TextDecoder().decode(files.stdout).trim().split('\n').filter(p => /\.(?:ts|tsx|js|json|sql|md|css|html|toml|yaml|yml|txt|svg)$/.test(p))) { const text = await readFile(path, 'utf8'); check(f.identities.every(i => !text.includes(i.password)), 'Credential found in repository artifact'); scanned++; }
  const credentialText = `Dental GO+ — tài khoản CMS local\n\nCMS: http://127.0.0.1:5891/cms?tenant=${f.tenant.id}\nWebsite VI: http://localhost:5892/dental-go-plus\nWebsite EN: http://localhost:5892/dental-go-plus/en\n\nEmail: ${actor.email}\nMật khẩu: ${actor.password}\n\nTài khoản quản trị chỉ thuộc Dental GO+. Giữ file này riêng tư.\n`;
  const credentialPath = '.local/dental-go-login.txt';
  if (await Bun.file(credentialPath).exists()) check(await privateDentalGoText(credentialPath) === credentialText, 'Credential handoff changed');
  else await writeFile(credentialPath, credentialText, { flag: 'wx', mode: 0o600 });
  const report = { status: 'PASS', recordedAt: new Date().toISOString(), tenantId: f.tenant.id, variants: pages.length, pages, mediaReady: media.assets.length, eligibleImageUrls: paths.size, crossTenantStatus: denied.status, completedSeedReplayPreservedCmsChanges: true, scannedFiles: scanned, credentialsPrinted: false, credentialFile: credentialPath, homeContentHash: createHash('sha256').update(JSON.stringify(after.content)).digest('hex'), review: 'Sequential self-review, browser workflow evidence recorded separately' };
  await writeFile(`docs/evidence/dental-go/verification-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.info(JSON.stringify({ status: report.status, variants: pages.length, mediaReady: media.assets.length, eligibleImageUrls: paths.size, crossTenantStatus: denied.status, seedReplayPreservedCmsChanges: true, scannedFiles: scanned, credentialsPrinted: false }));
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'clinic-verification', message: error instanceof Error ? error.message : 'Unknown error' })); process.exitCode = 1; });
