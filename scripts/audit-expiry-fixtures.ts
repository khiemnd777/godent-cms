import { SQL } from 'bun';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { openPasswordSession } from './s02-fixtures';

export const AUDIT_FIXTURE_PATH = '.local/audit-expiry-fixtures.json';
export const AUDIT_FIXTURE_OWNER = 'GCMS-AUDIT-EXPIRY-001-v1';
export type AuditTenantLabel = 'Red' | 'Green' | 'Control';
export interface AuditIdentity { label: 'Platform' | 'Tenant' | 'Control'; userId: string; email: string; password: string }
export interface AuditTenant {
  label: AuditTenantLabel; id: string; name: string;
  audit: { authenticatedOld: string; authenticatedYoung: string; globalOld: string; globalUnselected: string; anonymousOld: string; anonymousYoung: string; systemOld: string; systemYoung: string };
}
export interface AuditFixtures {
  owner: typeof AUDIT_FIXTURE_OWNER; runId: string; status: 'prepared' | 'complete';
  identities: AuditIdentity[]; tenants: AuditTenant[];
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export async function privateText(path: string) {
  const meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || (meta.mode & 0o777) !== 0o600 || meta.uid !== process.getuid?.() || meta.size > 1048576) throw new Error('Unsafe private audit input');
  return readFile(path, 'utf8');
}
export async function readAuditFixtures(): Promise<AuditFixtures> {
  const value = JSON.parse(await privateText(AUDIT_FIXTURE_PATH)) as AuditFixtures;
  if (value.owner !== AUDIT_FIXTURE_OWNER || !uuid(value.runId) || !['prepared', 'complete'].includes(value.status) || value.tenants?.length !== 3 || value.identities?.length !== 3) throw new Error('Wrong audit fixture ownership');
  const ids = new Set<string>();
  for (const label of ['Red', 'Green', 'Control'] as const) {
    const t = value.tenants.find(t => t.label === label);
    if (!t || !uuid(t.id) || ids.has(t.id) || t.name !== `Audit expiry ${label} ${value.runId}` || Object.values(t.audit).length !== 8 || !Object.values(t.audit).every(uuid)) throw new Error('Wrong owned audit tenant');
    ids.add(t.id);
  }
  for (const label of ['Platform', 'Tenant', 'Control'] as const) {
    const i = value.identities.find(i => i.label === label);
    if (!i || !uuid(i.userId) || i.email !== `audit-${value.runId}-${label.toLowerCase()}@synthetic.example.test` || typeof i.password !== 'string' || i.password.length < 20) throw new Error('Wrong owned audit actor');
  }
  return value;
}
export async function readWorkerConfig() {
  return Object.fromEntries((await privateText('.local/m2.env')).trim().split('\n').map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
}
export async function readLifecycleUrl() {
  const text = await privateText('.local/m5.env');
  const line = text.trim().split('\n').find(line => line.startsWith('M5_LIFECYCLE_DATABASE_URL='));
  return validateDatabaseUrl(line?.slice(line.indexOf('=') + 1), 'gcms_m5_worker');
}
async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || !['--local-audit-expiry --synthetic-fixtures', '--local-audit-expiry --enroll-audit-worker'].includes(process.argv.slice(2).join(' '))) throw new Error('Explicit audit fixture preparation required');
  const directory = await lstat('.local');
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700) throw new Error('Unsafe private directory');
  if (!await Bun.file('.local/audit-expiry-baseline.json').exists()) throw new Error('Preservation baseline required');
  if (process.argv.includes('--enroll-audit-worker')) {
    const f = await readAuditFixtures(); if (f.status !== 'complete') throw new Error('Complete new fixtures required');
    await writeFile('.local/audit-expiry-worker.json', JSON.stringify({ owner: f.owner, runId: f.runId, tenantIds: f.tenants.map(t => t.id) }) + '\n', { flag: 'wx', mode: 0o600 });
    console.info(JSON.stringify({ status: 'PASS', phase: 'explicit-audit-worker-manifest', tenants: 3, databaseEnrollmentChanged: false })); return;
  }
  if (await Bun.file(AUDIT_FIXTURE_PATH).exists()) throw new Error('Exclusive fixture manifest exists; no reset or preparation replay');
  const runId = randomUUID();
  const fixtures: AuditFixtures = {
    owner: AUDIT_FIXTURE_OWNER, runId, status: 'prepared',
    identities: (['Platform', 'Tenant', 'Control'] as const).map(label => ({ label, userId: randomUUID(), email: `audit-${runId}-${label.toLowerCase()}@synthetic.example.test`, password: randomBytes(24).toString('base64url') })),
    tenants: (['Red', 'Green', 'Control'] as const).map(label => ({ label, id: randomUUID(), name: `Audit expiry ${label} ${runId}`, audit: { authenticatedOld: randomUUID(), authenticatedYoung: randomUUID(), globalOld: randomUUID(), globalUnselected: randomUUID(), anonymousOld: randomUUID(), anonymousYoung: randomUUID(), systemOld: randomUUID(), systemYoung: randomUUID() } })),
  };
  await writeFile(AUDIT_FIXTURE_PATH, JSON.stringify(fixtures, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const runtime = await loadRuntimeEnvironment(), db = createS02Database(runtime.api), auth = createS02Auth(db, runtime.api);
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await db.verifyRoles();
    const context = await auth.auth.$context;
    for (const i of fixtures.identities) {
      if (await context.internalAdapter.findUserByEmail(i.email)) throw new Error('New actor collision');
      const password = await context.password.hash(i.password);
      const user = await context.internalAdapter.createUser({ id: i.userId, name: `Audit synthetic ${i.label}`, email: i.email, emailVerified: true, platformAdmin: i.label === 'Platform' }, { method: 'email-password' });
      if (user.id !== i.userId) throw new Error('New actor identity mismatch');
      await context.internalAdapter.createAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password });
    }
    const platform = await openPasswordSession(auth, fixtures.identities.find(i => i.label === 'Platform')!);
    await owner.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`SELECT set_config('gcms.actor_id',${platform.actor.userId},true),set_config('gcms.session_id',${platform.actor.sessionId},true)`;
      const newer = await tx`SELECT to_regclass('gcms_s06.audit_retention_scope') AS present`;
      for (const t of fixtures.tenants) {
        await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${t.id},${t.name})`;
        await tx`SELECT gcms_m5.initialize_new_tenant(${t.id},${JSON.stringify({ mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null })}::text::jsonb)`;
        const actor = fixtures.identities.find(i => i.label === (t.label === 'Control' ? 'Control' : 'Tenant'))!;
        await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${t.id},${actor.userId})`;
        await tx`INSERT INTO gcms_s06.worker_scope(tenant_id,enabled) VALUES(${t.id},true)`;
        if (newer[0]?.present) await tx`INSERT INTO gcms_s06.audit_retention_scope(tenant_id,enabled) VALUES(${t.id},true)`;
        await tx`INSERT INTO gcms_s06.audit_scope VALUES(${t.id},'s02',${t.audit.globalOld})`;
        if (t.label !== 'Control') await tx`INSERT INTO gcms_m5.worker_scope(tenant_id,allow_deletion) VALUES(${t.id},true)`;
        await tx`INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES
          (${t.audit.authenticatedOld},${t.id},${actor.userId},'synthetic.old',${t.id},clock_timestamp()-interval '366 days'),
          (${t.audit.authenticatedYoung},${t.id},${actor.userId},'synthetic.young',${t.id},clock_timestamp()-interval '364 days'),
          (${t.audit.globalOld},NULL,${actor.userId},'synthetic.selected',${t.id},clock_timestamp()-interval '366 days'),
          (${t.audit.globalUnselected},NULL,${actor.userId},'synthetic.unselected',${t.id},clock_timestamp()-interval '366 days')`;
        await tx`INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id,created_at) VALUES
          (${t.audit.anonymousOld},${t.id},'consultation.accepted',${t.id},clock_timestamp()-interval '366 days'),
          (${t.audit.anonymousYoung},${t.id},'consultation.accepted',${t.id},clock_timestamp()-interval '364 days')`;
        await tx`INSERT INTO gcms_s06.audit_event(id,tenant_id,event,target_id,created_at) VALUES
          (${t.audit.systemOld},${t.id},'lead.deleted',${t.id},clock_timestamp()-interval '366 days'),
          (${t.audit.systemYoung},${t.id},'lead.deleted',${t.id},clock_timestamp()-interval '364 days')`;
      }
    });
    fixtures.status = 'complete';
    const temp = `${AUDIT_FIXTURE_PATH}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(fixtures, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, AUDIT_FIXTURE_PATH);
    console.info(JSON.stringify({ status: 'PASS', phase: 'new_owned_audit_fixtures', tenants: 3, identities: 3, oldCredentialsChanged: false, oldBacklogDispatched: false }));
  } finally { await db.close(); await owner.close(); }
}
if (import.meta.main) void main().catch(async error => {
  await writeFile(`.local/audit-fixture-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown', code: (error as { code?: string }).code }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error('Audit fixture preparation failed; private diagnostic retained, no reset performed.'); process.exitCode = 1;
});
