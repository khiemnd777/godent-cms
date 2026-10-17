import { SQL } from 'bun';
import { beforeAll, afterAll, describe, test, expect } from 'bun:test';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { createS02Database, postgresCode, type S02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { validateDatabaseUrl } from '../src/auth/policy';
import { RetentionWorker } from '../src/worker/retention-worker';
import { M5LifecycleWorker } from '../src/worker/m5-lifecycle-worker';
import type { M5PlatformStatus, M5CommandResult } from '../src/contracts/m5-platform';
import { readAuditFixtures, readLifecycleUrl, readWorkerConfig, type AuditFixtures, type AuditTenant } from '../../../scripts/audit-expiry-fixtures';
import { openPasswordSession } from '../../../scripts/s02-fixtures';

const enabled = process.env.AUDIT_EXPIRY_INTEGRATION === '1';
const phase = process.env.AUDIT_EXPIRY_PHASE ?? 'green';
describe.skipIf(!enabled)('Audit expiry actual PostgreSQL after confirmed tenant deletion', () => {
  let fixtures: AuditFixtures, target: AuditTenant, owner: SQL, restricted: SQL, worker: RetentionWorker, lifecycle: M5LifecycleWorker;
  let db: S02Database, auth: ReturnType<typeof createS02Auth>, app: INestApplication, base: string;
  const sessions = new Map<string, Awaited<ReturnType<typeof openPasswordSession>>>();
  const receipts: Record<string, unknown>[] = [];
  async function owned<T>(run: (tx: SQL) => Promise<T>) { return owner.begin(async tx => { await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); return run(tx as unknown as SQL); }); }
  async function response(path: string, method = 'GET', body?: unknown, label = 'Tenant') {
    const s = sessions.get(label)!;
    return fetch(base + path, { method, headers: { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', cookie: s.headers.get('cookie') ?? '', ...(body === undefined ? {} : { 'content-type': 'application/json', 'x-csrf-token': auth.csrfToken(s.actor) }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  }
  async function command(action: string, body: unknown, platform = false) {
    const r = await response(`${platform ? '/api/platform/tenants' : '/api/cms/tenants'}/${target.id}/m5${platform ? '' : '/platform'}/deletion/${action}`, 'POST', body, platform ? 'Platform' : 'Tenant');
    if (r.status !== 200 && r.status !== 201) throw new Error(`Owned deletion ${action} failed ${r.status}`);
    return (await r.json() as M5CommandResult).status;
  }
  async function auditRows(t: AuditTenant) {
    return owned(async tx => {
      const all = [];
      for (const table of ['gcms_s02.audit_event', 'gcms_s04.audit_event', 'gcms_s06.audit_event']) all.push(...await tx.unsafe(`SELECT to_jsonb(x)::text AS value FROM ${table} x WHERE tenant_id=$1 OR id=$2 OR id=$3 ORDER BY id`, [t.id, t.audit.globalOld, t.audit.globalUnselected]));
      return all.map(r => createHash('sha256').update(String(r.value)).digest('hex')).sort();
    });
  }
  beforeAll(async () => {
    if (!['red', 'green'].includes(phase)) throw new Error('Explicit regression phase required');
    fixtures = await readAuditFixtures(); if (fixtures.status !== 'complete') throw new Error('Owned fixtures not complete');
    target = fixtures.tenants.find(t => t.label === (phase === 'red' ? 'Red' : 'Green'))!;
    const runtime = await loadRuntimeEnvironment(); Object.assign(process.env, runtime.api);
    db = createS02Database(runtime.api); auth = createS02Auth(db, runtime.api);
    owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 3, connectionTimeout: 3 });
    const env = await readWorkerConfig(), url = validateDatabaseUrl(env.S06_WORKER_DATABASE_URL, 'gcms_s06_worker');
    restricted = new SQL(url, { max: 3, connectionTimeout: 3 }); worker = new RetentionWorker(url, { async capture() { throw new Error('Audit-only tests must not capture'); } });
    lifecycle = new M5LifecycleWorker(await readLifecycleUrl(), { async deleteVerified() { throw new Error('No media objects belong to audit fixtures'); }, close() {} });
    const compiled = await import('../dist/app.js' as string) as { createApp(): Promise<INestApplication> }; app = await compiled.createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    for (const label of ['Platform', 'Tenant']) sessions.set(label, await openPasswordSession(auth, fixtures.identities.find(i => i.label === label)!));
  }, 30000);
  afterAll(async () => {
    await writeFile(`docs/evidence/audit-expiry/regression-${phase}-${Date.now()}.json`, JSON.stringify({ recordedAt: new Date().toISOString(), phase, receipts, mutations: 'Only manifest-owned new fixtures', natural365DayWaiting: 'NOT_RUN' }, null, 2) + '\n', { flag: 'wx' });
    await app?.close(); await worker?.close(); await lifecycle?.close(); await restricted?.close(); await db?.close(); await owner?.close();
  });
  test('retained due audit expires after real request confirmation execution and cleanup', async () => {
    const control = fixtures.tenants.find(t => t.label === 'Control')!, controlBefore = await auditRows(control);
    const preflight = await owned(tx => tx`SELECT t.name,t.status,s.phase,s.started_at,w.allow_deletion FROM gcms_s02.tenant t JOIN gcms_m5.tenant_state s ON s.tenant_id=t.id JOIN gcms_m5.worker_scope w ON w.tenant_id=t.id WHERE t.id=${target.id}`);
    expect(preflight).toHaveLength(1); expect(preflight[0]).toMatchObject({ name: target.name, status: 'active', phase: 'none', started_at: null, allow_deletion: true });
    const auditBefore = await auditRows(target);
    const currentResponse = await response(`/api/platform/tenants/${target.id}/m5`, 'GET', undefined, 'Platform'); expect(currentResponse.status).toBe(200);
    let state = await currentResponse.json() as M5PlatformStatus;
    const executeAfter = new Date(Date.now() + 1000).toISOString(), reason = 'Approved new synthetic audit regression tenant only';
    state = await command('request', { operationId: randomUUID(), expectedVersion: state.version, reason, tenantId: target.id, scope: 'all-active-tenant-data', executeAfter });
    state = await command('confirm', { operationId: randomUUID(), expectedVersion: state.version, reason, tenantId: target.id, scope: 'all-active-tenant-data', executeAfter, requestId: state.deletion.requestId });
    await Bun.sleep(Math.max(1, Date.parse(executeAfter) - Date.now() + 30));
    state = await command('execute', { operationId: randomUUID(), expectedVersion: state.version, reason, requestId: state.deletion.requestId }, true);
    expect(state.status).toBe('deleting');
    expect(await lifecycle.runOnce(target.id)).toEqual({ status: 'completed', deletedObjects: 0 });
    expect(await auditRows(target)).toEqual(expect.arrayContaining(auditBefore));
    expect(await auditRows(control)).toEqual(controlBefore);
    const scopes = await owned(tx => tx`SELECT (SELECT count(*)::integer FROM gcms_s06.worker_scope WHERE tenant_id=${target.id}) AS business,(SELECT phase FROM gcms_m5.tenant_state WHERE tenant_id=${target.id}) AS phase`);
    expect(scopes[0]).toEqual({ business: 0, phase: 'completed' });
    receipts.push({ kind: 'confirmed-new-tenant-deleted', tenantId: target.id, requestId: state.deletion.requestId, businessScopeRemoved: true, auditsPreservedBeforeExpiry: true });
    // RED fails here on old code with 42501. Never recreate/reset this tenant.
    const expired = await worker.expireAudit(target.id);
    expect(expired).toEqual({ authenticated: 2, anonymous: 1, system: 1 });
    expect(await auditRows(control)).toEqual(controlBefore);
    const remaining = await owned(tx => tx`SELECT id FROM gcms_s02.audit_event WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify([target.audit.authenticatedYoung, target.audit.globalUnselected, target.audit.globalOld, target.audit.authenticatedOld])}::text::jsonb)) ORDER BY id`);
    expect(remaining.map((r: { id: string }) => r.id).sort()).toEqual([target.audit.authenticatedYoung, target.audit.globalUnselected].sort());
    for (const [table, old, young] of [['gcms_s04.audit_event', target.audit.anonymousOld, target.audit.anonymousYoung], ['gcms_s06.audit_event', target.audit.systemOld, target.audit.systemYoung]]) {
      expect((await owned(tx => tx.unsafe(`SELECT id FROM ${table} WHERE id=$1 OR id=$2`, [old, young]))).map((r: { id: string }) => r.id)).toEqual([young]);
    }
    receipts.push({ kind: 'audit-expired-after-deletion', tenantId: target.id, counts: expired, controlAndYoungAndUnselectedPreserved: true });
  }, 30000);
  if (phase === 'green') {
    test('deleted tenant cannot read/export, claim leads or run the mixed worker', async () => {
      const list = await response(`/api/tenants/${target.id}/leads`); expect(list.status).toBe(403);
      const exported = await response(`/api/cms/tenants/${target.id}/m5/platform/export`); expect(exported.status).toBe(403);
      await expect(worker.claim(target.id)).rejects.toMatchObject({ errno: '42501' });
      await expect(worker.runOnce(target.id)).rejects.toMatchObject({ errno: '42501' });
      const rows = await owned(tx => tx`SELECT (SELECT count(*)::integer FROM gcms_s05.delivery WHERE tenant_id=${target.id}) AS deliveries,(SELECT count(*)::integer FROM gcms_s06.job WHERE tenant_id=${target.id}) AS jobs,(SELECT count(*)::integer FROM gcms_s02.membership WHERE tenant_id=${target.id}) AS members`);
      expect(rows[0]).toEqual({ deliveries: 0, jobs: 0, members: 0 });
    });
    test('disabled or absent audit scope and non-worker roles stay denied', async () => {
      const control = fixtures.tenants.find(t => t.label === 'Control')!, before = await auditRows(control);
      await owned(tx => tx`UPDATE gcms_s06.audit_retention_scope SET enabled=false WHERE tenant_id=${control.id}`);
      try { await expect(worker.expireAudit(control.id)).rejects.toMatchObject({ errno: '42501' }); }
      finally { await owned(tx => tx`UPDATE gcms_s06.audit_retention_scope SET enabled=true WHERE tenant_id=${control.id}`); }
      await expect(worker.expireAudit(randomUUID())).rejects.toMatchObject({ errno: '42501' });
      for (const role of ['gcms_s02_tenant', 'gcms_s02_platform', 'gcms_s02_auth', 'gcms_s04_intake', 'gcms_s05_worker', 'gcms_s07_worker', 'gcms_m5_worker']) {
        const rights = await owned(tx => tx`SELECT has_function_privilege(${role},'gcms_s06.worker_expire_audit(text,integer)','EXECUTE') AS execute,has_table_privilege(${role},'gcms_s06.audit_retention_scope','SELECT,INSERT,UPDATE,DELETE') AS direct`);
        expect(rights[0]).toEqual({ execute: false, direct: false });
      }
      const env = await readWorkerConfig(), wrong = new SQL(validateDatabaseUrl(process.env.S02_TENANT_DATABASE_URL, 'gcms_s02_tenant'), { max: 1 });
      try { await expect(Promise.resolve(wrong`SELECT gcms_s06.worker_expire_audit(${target.id},100)`)).rejects.toMatchObject({ errno: '42501' }); }
      finally { await wrong.close(); }
      expect(env.S06_WORKER_DATABASE_URL).toBeTruthy(); expect(await auditRows(control)).toEqual(before);
    });
    test('audit batch validates limits, serializes concurrent expiry and repeats safely', async () => {
      for (const limit of [0, 101, null]) await expect(Promise.resolve(restricted`SELECT gcms_s06.worker_expire_audit(${target.id},${limit})`)).rejects.toMatchObject({ errno: '22023' });
      const ids = Array.from({ length: 5 }, () => randomUUID()), actor = fixtures.identities.find(i => i.label === 'Tenant')!;
      await owned(async tx => { for (const id of ids) await tx`INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(${id},${target.id},${actor.userId},'synthetic.batch',${target.id},clock_timestamp()-interval '366 days')`; });
      const results = await Promise.all([worker.expireAudit(target.id), worker.expireAudit(target.id)]);
      expect(results.map(r => r.authenticated).sort()).toEqual([0, 5]); expect(results.every(r => r.anonymous === 0 && r.system === 0)).toBe(true);
      expect(await worker.expireAudit(target.id)).toEqual({ authenticated: 0, anonymous: 0, system: 0 });
      await expect(Promise.resolve(restricted`SELECT count(*) FROM gcms_s06.audit_retention_scope`)).rejects.toMatchObject({ errno: '42501' });
      receipts.push({ kind: 'concurrent-audit-expiry', tenantId: target.id, results, repeatedCount: 0 });
    });
    test('active and suspended audit predicates work in rollback without changing control data', async () => {
      const control = fixtures.tenants.find(t => t.label === 'Control')!, before = await auditRows(control);
      class AuditProbeRollback extends Error {}
      const outcomes: Array<{ status: string; counts: { authenticated: number; anonymous: number; system: number } }> = [];
      for (const status of ['active', 'suspended']) {
        try {
          await owned(async tx => {
            await tx`UPDATE gcms_s02.tenant SET status=${status} WHERE id=${control.id}`;
            const rows = await tx`SELECT gcms_s06.worker_expire_audit(${control.id},100) AS result`;
            expect(rows[0].result).toEqual({ authenticated: 2, anonymous: 1, system: 1 }); outcomes.push({ status, counts: rows[0].result });
            throw new AuditProbeRollback('Intentional fixture-only expiry rollback');
          });
        } catch (error) { if (!(error instanceof AuditProbeRollback)) throw error; }
        expect(await auditRows(control)).toEqual(before);
      }
      expect((await owned(tx => tx`SELECT status FROM gcms_s02.tenant WHERE id=${control.id}`))[0].status).toBe('active');
      receipts.push({ kind: 'active-suspended-audit-sql-rollback', controlUnchanged: true, outcomes, executedAs: 'fixture-owner; restricted worker authorization tested separately' });
    });
    test('audit expiry and stale cleanup serialize on the tenant lock without business reactivation', async () => {
      const state = (await owned(tx => tx`SELECT request_id,fence,phase FROM gcms_m5.tenant_state WHERE tenant_id=${target.id}`))[0]; expect(state.phase).toBe('completed');
      const stale = new SQL(await readLifecycleUrl(), { max: 1, connectionTimeout: 3 });
      await stale`SELECT 1`; await worker.verifyRole();
      let unlock!: () => void, ready!: () => void;
      const held = new Promise<void>(resolve => { unlock = resolve; }), acquired = new Promise<void>(resolve => { ready = resolve; });
      const locker = owned(async tx => { await tx`SELECT pg_advisory_xact_lock(hashtextextended(${target.id},7202))`; ready(); await held; });
      let auditSettled = false, cleanupSettled = false;
      try {
        await acquired;
        const audit = worker.expireAudit(target.id).finally(() => { auditSettled = true; });
        const cleanup = (async () => { try { await stale`SELECT gcms_m5.lifecycle_cleanup(${target.id},${String(state.request_id)},${randomUUID()},${Number(state.fence)})`; return 'unexpected-success'; } catch (error) { return postgresCode(error); } finally { cleanupSettled = true; } })();
        await Bun.sleep(100); expect(auditSettled).toBe(false); expect(cleanupSettled).toBe(false);
        unlock(); await locker;
        expect(await cleanup).toBe('42501'); expect(await audit).toEqual({ authenticated: 0, anonymous: 0, system: 0 });
        expect((await owned(tx => tx`SELECT count(*)::integer AS n FROM gcms_s06.worker_scope WHERE tenant_id=${target.id}`))[0].n).toBe(0);
        receipts.push({ kind: 'audit-vs-stale-cleanup-tenant-lock', auditWaited: true, staleCleanupWaited: true, staleCleanupCode: '42501', validFreshCleanupOverlap: 'NOT_RUN; actual fresh deletion->expiry is a separate case' });
      } finally { unlock(); await locker; await stale.close(); }
    }, 10000);
    test('audit-only built CLI succeeds after mixed worker is denied and rejects unselected tenant', async () => {
      const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]!])), control = fixtures.tenants.find(t => t.label === 'Control')!, before = await auditRows(control);
      const run = async (tenant: string) => {
        const child = Bun.spawn([process.execPath, '--no-env-file', 'scripts/start-audit-expiry-worker.ts', '--tenant', tenant, '--once'], { env, stdout: 'pipe', stderr: 'pipe' });
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]); return { stdout, stderr, code };
      };
      const good = await run(target.id); expect(good.code).toBe(0); expect(good.stderr).toBe('');
      const result = JSON.parse(good.stdout); expect(result).toEqual({ status: 'completed', mode: 'audit-only', tenantId: target.id, audit: { authenticated: 0, anonymous: 0, system: 0 } });
      const bad = await run(randomUUID()); expect(bad.code).toBe(1); expect(bad.stdout).toBe(''); expect(bad.stderr).toContain('refused');
      expect(await auditRows(control)).toEqual(before);
      receipts.push({ kind: 'actual-built-audit-only-cli', result, wrongTenantExit: bad.code, controlUnchanged: true });
    }, 15000);
  }
});
