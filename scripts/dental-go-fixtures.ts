import { SQL } from 'bun';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { openPasswordSession } from './s02-fixtures';

export const DENTAL_GO_OWNER = 'GCMS-DENTAL-GO-PLUS-001-v1';
const MANIFEST = '.local/dental-go-fixtures.json';
export interface DentalGoIdentity { label: 'Platform' | 'Owner'; userId: string; email: string; password: string; name: string }
export interface DentalGoFixtures { owner: typeof DENTAL_GO_OWNER; runId: string; status: 'prepared' | 'complete'; createdAt: string; tenant: { id: string; slug: 'dental-go-plus'; name: 'Dental GO+' }; identities: DentalGoIdentity[] }
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
export async function privateDentalGoText(path: string) {
  const directory = await lstat('.local'), file = await lstat(path);
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid?.() || !file.isFile() || file.isSymbolicLink() || (file.mode & 0o777) !== 0o600 || file.uid !== process.getuid?.() || file.size > 4_194_304) throw new Error('Unsafe private clinic input');
  return readFile(path, 'utf8');
}
export async function readDentalGoFixtures(): Promise<DentalGoFixtures> {
  const f = JSON.parse(await privateDentalGoText(MANIFEST)) as DentalGoFixtures;
  if (f.owner !== DENTAL_GO_OWNER || !uuid(f.runId) || !uuid(f.tenant?.id) || f.tenant.slug !== 'dental-go-plus' || f.tenant.name !== 'Dental GO+' || !['prepared', 'complete'].includes(f.status) || f.identities?.length !== 2) throw new Error('Wrong clinic ownership');
  const seen = new Set<string>();
  for (const label of ['Platform', 'Owner'] as const) {
    const i = f.identities.find(i => i.label === label);
    if (!i || !uuid(i.userId) || seen.has(i.userId) || i.email !== `dental-go-${f.runId}-${label.toLowerCase()}@local.example.test` || typeof i.password !== 'string' || i.password.length < 24) throw new Error('Wrong owned clinic identity');
    seen.add(i.userId);
  }
  return f;
}
async function store(f: DentalGoFixtures) {
  const previous = await readDentalGoFixtures();
  if (previous.runId !== f.runId || previous.tenant.id !== f.tenant.id) throw new Error('Clinic manifest changed');
  const temp = `.local/dental-go-manifest-${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(f, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, MANIFEST);
}
async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || process.argv.slice(2).join(' ') !== '--local-dental-go --provision') throw new Error('Explicit pinned clinic provisioning required');
  const directory = await lstat('.local');
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid?.() || !await Bun.file('.local/dental-go-baseline.json').exists()) throw new Error('Protected baseline required');
  if (!await Bun.file(MANIFEST).exists()) {
    const runId = randomUUID();
    const f: DentalGoFixtures = { owner: DENTAL_GO_OWNER, runId, status: 'prepared', createdAt: new Date().toISOString(), tenant: { id: randomUUID(), slug: 'dental-go-plus', name: 'Dental GO+' }, identities: (['Platform', 'Owner'] as const).map(label => ({ label, userId: randomUUID(), email: `dental-go-${runId}-${label.toLowerCase()}@local.example.test`, password: randomBytes(24).toString('base64url'), name: label === 'Platform' ? 'Dental GO+ Provisioning' : 'Nguyễn An Nhiên' })) };
    await writeFile(MANIFEST, JSON.stringify(f, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  const f = await readDentalGoFixtures();
  if (f.status === 'complete') { console.info(JSON.stringify({ status: 'PASS', phase: 'owned-clinic-exists', reset: false })); return; }
  const runtime = await loadRuntimeEnvironment(), db = createS02Database(runtime.api), auth = createS02Auth(db, runtime.api);
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await db.verifyRoles();
    const context = await auth.auth.$context;
    for (const i of f.identities) {
      const old = await context.internalAdapter.findUserByEmail(i.email, { includeAccounts: true });
      if (old) {
        if (old.user.id !== i.userId || !old.accounts.some(a => a.providerId === 'credential')) throw new Error('Owned account mismatch');
      } else {
        const password = await context.password.hash(i.password);
        const u = await context.internalAdapter.createUser({ id: i.userId, name: i.name, email: i.email, emailVerified: true, platformAdmin: i.label === 'Platform' }, { method: 'email-password' });
        if (u.id !== i.userId) throw new Error('Owned identity mismatch');
        await context.internalAdapter.createAccount({ userId: u.id, accountId: u.id, providerId: 'credential', password });
      }
    }
    const platform = await openPasswordSession(auth, f.identities.find(i => i.label === 'Platform')!);
    await owner.begin(async tx => {
      await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='10s'");
      await tx`SELECT set_config('gcms.actor_id',${platform.actor.userId},true),set_config('gcms.session_id',${platform.actor.sessionId},true)`;
      const inserted = await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${f.tenant.id},${f.tenant.name}) ON CONFLICT DO NOTHING RETURNING id`;
      const actual = await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${f.tenant.id}`;
      if (actual[0]?.name !== f.tenant.name || actual[0]?.status !== 'active') throw new Error('Owned tenant mismatch');
      if (inserted.length) await tx`SELECT gcms_m5.initialize_new_tenant(${f.tenant.id},${JSON.stringify({ mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null })}::text::jsonb)`;
      const policy = await tx`SELECT mode FROM gcms_m5.tenant_state WHERE tenant_id=${f.tenant.id}`;
      if (policy[0]?.mode !== 'monitor') throw new Error('Owned clinic policy mismatch');
      for (const i of f.identities.filter(i => i.label !== 'Platform')) await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${f.tenant.id},${i.userId}) ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${f.tenant.id},true) ON CONFLICT DO NOTHING`;
    });
    const signed = await openPasswordSession(auth, f.identities.find(i => i.label === 'Owner')!), publishing = new PublicationServiceOperations(db, auth);
    const headers = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', 'content-type': 'application/json', cookie: signed.headers.get('cookie') ?? '', 'x-csrf-token': auth.csrfToken(signed.actor) };
    const request = { method: 'GET', originalUrl: `/api/tenants/${f.tenant.id}/publication`, headers };
    let site = await publishing.getSite(request, f.tenant.id);
    if (!site.version) site = await publishing.saveSite({ ...request, method: 'PUT' }, f.tenant.id, { slug: f.tenant.slug, name: f.tenant.name, footer: { intro: 'Chăm sóc nụ cười. Thêm một chút an tâm.', body: legacyDocument('Dental GO+ lắng nghe và giải thích rõ từng bước để bạn chủ động chăm sóc nụ cười.') }, expectedVersion: 0 });
    if (site.slug !== f.tenant.slug || site.name !== f.tenant.name) throw new Error('Owned site identity changed');
    f.status = 'complete'; await store(f);
    console.info(JSON.stringify({ status: 'PASS', phase: 'owned-clinic-provisioned', newTenants: 1, newIdentities: 2, oldCredentialsChanged: false, workerDispatched: false }));
  } finally { await db.close(); await owner.close(); }
}
if (import.meta.main) void main().catch(async error => {
  const e = error as { code?: string; message?: string; detail?: string };
  await writeFile(`.local/dental-go-provision-error-${Date.now()}.json`, JSON.stringify({ code: e.code, message: e.message, detail: e.detail }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error('Clinic provisioning refused/failed; private diagnostic retained.'); process.exitCode = 1;
});
