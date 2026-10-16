import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LeadNotificationWorker } from '../src/worker/lead-worker';
import { LocalLeadCapture, PermanentCaptureFailure, type LeadCaptureTransport } from '../src/worker/local-capture';
import { S05_ROUTES, type RecipientSettings } from '../src/contracts/s05';
import { postgresCode } from '../src/database';
import { selectWorkerEnvironment } from '../../../scripts/start-s05-worker';
import { S05Harness, type TestSource } from './s05-support';

const h = new S05Harness(), workers: LeadNotificationWorker[] = [];
let raw: SQL;
function make(transport?: LeadCaptureTransport) { const w = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, transport); workers.push(w); return w; }
async function source(label: string) {
  const s = await h.source(label); await h.intake(s);
  await h.owned(tx => tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`); return s;
}
async function state(s: TestSource) { return h.owned(tx => tx`SELECT i.status,i.blocked_reason,(SELECT jsonb_agg(to_jsonb(d)) FROM gcms_s05.delivery d WHERE d.tenant_id=i.tenant_id AND d.lead_id=i.lead_id) AS deliveries FROM gcms_s04.notification_intent i WHERE i.tenant_id=${s.tenantId}`); }
async function due(s: TestSource) { await h.owned(async tx => {
  await tx`UPDATE gcms_s05.delivery SET available_at=clock_timestamp()-interval '1 second',lease_until=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`;
  await tx`UPDATE gcms_s04.notification_intent SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`;
}); }
async function selectRecipients(s: TestSource, ids: string[]) {
  const path = S05_ROUTES.settings(s.tenantId), current = (await h.call<RecipientSettings>(path)).value;
  const saved = await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: current.version, mode: 'selected', recipientUserIds: ids }); expect(saved.status).toBe(200);
}
async function waitStarted(directory: string, child: ReturnType<typeof Bun.spawn>) {
  const deadline = Date.now() + 15000;
  while (!await Bun.file(join(directory, 'started.json')).exists()) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Owned worker did not start'); await Bun.sleep(25);
  }
}
function faultProcess(s: TestSource, directory: string, mode: string) {
  return Bun.spawn([process.execPath, '--no-env-file', 'apps/api/test/s05-worker-process.ts', s.tenantId, directory, mode], {
    env: selectWorkerEnvironment({ S05_WORKER_DATABASE_URL: process.env.S05_WORKER_DATABASE_URL! }, process.env), stdout: 'pipe', stderr: 'pipe' });
}

describe.skipIf(process.env.S05_INTEGRATION !== '1')('S05 actual restricted worker and controlled I/O faults', () => {
  beforeAll(async () => { await h.setup(); raw = new SQL(process.env.S05_WORKER_DATABASE_URL!, { max: 2, connectionTimeout: 3 }); }, 120000);
  afterAll(async () => { await Promise.all(workers.map(w => w.close())); await raw?.close(); await h.close(); });
  test('worker role cannot read private/auth tables, direct DML, unselected scope or null claim/fence', async () => {
    const w = make(); await w.verifyRole();
    for (const statement of ['SELECT * FROM gcms_s04.lead', 'SELECT * FROM gcms_s02_auth."user"', "UPDATE gcms_s04.lead SET status='new'"]) {
      let denied = false; try { await raw.unsafe(statement); } catch (error) { denied = postgresCode(error) === '42501'; } expect(denied).toBe(true);
    }
    let denied = false; try { await w.claim(randomUUID()); } catch (error) { denied = postgresCode(error) === '42501'; } expect(denied).toBe(true);
    const s = await source('worker-role');
    denied = false; try { await raw`SELECT gcms_s05.worker_claim(${s.tenantId},${w.workerId},NULL)`; } catch (error) { denied = postgresCode(error) === '42501'; } expect(denied).toBe(true);
    const [claim] = await w.claim(s.tenantId);
    expect((await raw`SELECT gcms_s05.worker_start(${s.tenantId},${claim.id},${w.workerId},NULL) AS value`)[0].value).toBeNull();
    expect((await raw`SELECT gcms_s05.worker_finish(${s.tenantId},${claim.id},${w.workerId},NULL,'captured') AS value`)[0].value).toBe(false);
  });
  test('two workers claim disjoint batches and selected scope cannot drain earlier fixture intents', async () => {
    const s = await source('worker-batch'); await h.bulk(s, 12); const a = make(), b = make();
    const [ca, cb] = await Promise.all([a.claim(s.tenantId), b.claim(s.tenantId)]);
    expect(ca.length).toBeLessThanOrEqual(10); expect(cb.length).toBeLessThanOrEqual(10);
    expect(new Set([...ca, ...cb].map(c => c.id)).size).toBe(ca.length + cb.length);
    expect(ca.length + cb.length).toBeGreaterThan(0); expect([...ca, ...cb].every(c => c.tenantId === s.tenantId)).toBe(true);
  });
  test('ineligible initial administrator blocks with no fallback; current selected recipients apply', async () => {
    const s = await source('worker-default');
    await h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${h.user('A1')}`);
    const w = make(); expect(await w.claim(s.tenantId)).toHaveLength(0); expect((await state(s))[0]).toMatchObject({ status: 'blocked', blocked_reason: 'recipient_unavailable' });
    const path = S05_ROUTES.settings(s.tenantId), current = (await h.call<RecipientSettings>(path, 'GET', undefined, 'A2')).value;
    expect(current.defaultRecipient?.userId).toBe(h.user('A1')); expect(current.defaultRecipient?.eligible).toBe(false);
    expect((await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: current.version, mode: 'selected', recipientUserIds: [h.user('A2')] }, 'A2')).status).toBe(200);
    await due(s); const directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), capture = make(new LocalLeadCapture(join(directory, 'capture')));
    expect((await capture.runOnce(s.tenantId)).captured).toBe(1); expect((await state(s))[0].status).toBe('captured');
  });
  test('setting changes during in-flight A require newly selected B; completed A never resends', async () => {
    const s = await source('worker-config'), directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), capture = new LocalLeadCapture(join(directory, 'capture'));
    let release!: () => void, started!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { started = resolve; });
    const a = make({ async capture(message) { started(); await gate; await capture.capture(message); } }), b = make(capture), [claim] = await a.claim(s.tenantId), active = a.process(claim);
    await ready; await selectRecipients(s, [h.user('A2')]); release(); expect(await active).toBe('captured');
    expect((await state(s))[0].status).toBe('pending'); expect((await b.runOnce(s.tenantId)).captured).toBe(1);
    expect((await state(s))[0].status).toBe('captured'); expect(await readdir(join(directory, 'capture'))).toHaveLength(2);
    expect((await b.runOnce(s.tenantId)).claimed).toBe(0);
  });
  test('actual separate process holds unsettled I/O beyond lease and budget without a second attempt', async () => {
    const s = await source('worker-unsettled'), directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), child = faultProcess(s, directory, 'hold');
    try {
      await waitStarted(directory, child); await Bun.sleep(31000); await due(s);
      const b = make(); expect(await b.claim(s.tenantId)).toHaveLength(0);
      const row = (await state(s))[0].deliveries as Array<{ attempts: number }>; expect(row[0].attempts).toBe(1);
      await writeFile(join(directory, 'release'), 'settle', { flag: 'wx', mode: 0o600 }); expect(await child.exited).toBe(0);
      const stderr = await new Response(child.stderr).text(); expect(stderr).toContain('exceeded 2s budget');
      expect(await readdir(join(directory, 'capture'))).toHaveLength(1); expect((await state(s))[0].status).toBe('captured');
    } finally { if (child.exitCode === null) { child.kill('SIGTERM'); await child.exited; } }
  }, 120000);
  test('process crashes before/after capture recover by delivery ID and preserve crash-safe backoff/fencing', async () => {
    for (const mode of ['crash_before', 'crash_after']) {
      const s = await source(`worker-${mode.replace('_', '-')}`), directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), child = faultProcess(s, directory, mode);
      await waitStarted(directory, child); expect(await child.exited).toBe(mode === 'crash_before' ? 31 : 32);
      const before = (await state(s))[0].deliveries as Array<{ id: string; worker_id: string; fence: number; attempts: number; started_at: string; available_at: string }>;
      expect(before[0].attempts).toBe(1); expect(Date.parse(before[0].available_at) - Date.parse(before[0].started_at)).toBe(60000);
      const b = make(new LocalLeadCapture(join(directory, 'capture'))); expect(await b.claim(s.tenantId)).toHaveLength(0);
      await due(s); const [claim] = await b.claim(s.tenantId); expect(claim.fence).toBeGreaterThan(before[0].fence);
      expect((await raw`SELECT gcms_s05.worker_finish(${s.tenantId},${before[0].id},${before[0].worker_id},${before[0].fence},'captured') AS value`)[0].value).toBe(false);
      expect(await b.process(claim)).toBe('captured'); expect(await readdir(join(directory, 'capture'))).toHaveLength(1);
    }
  }, 120000);
  test('transient retries respect bounded backoff and five-attempt budget; permanent failure is terminal', async () => {
    const s = await source('worker-retry'), failing = make({ async capture() { throw new Error('Owned transient fault'); } });
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await failing.runOnce(s.tenantId); expect(result.failed).toBe(1);
      const d = ((await state(s))[0].deliveries as Array<{ attempts: number; status: string; available_at: string }>)[0]; expect(d.attempts).toBe(attempt);
      if (attempt < 5) { expect(d.status).toBe('pending'); expect(await failing.claim(s.tenantId)).toHaveLength(0); await due(s); }
      else { expect(d.status).toBe('failed'); expect((await state(s))[0].status).toBe('failed'); }
    }
    const permanent = await source('worker-permanent'), w = make({ async capture() { throw new PermanentCaptureFailure('Owned permanent fault'); } });
    expect((await w.runOnce(permanent.tenantId)).failed).toBe(1); expect((await state(permanent))[0].status).toBe('failed'); expect(await w.claim(permanent.tenantId)).toHaveLength(0);
  });
  test('suspension/revoke/close/expiry are checked again after claim and before attempt start', async () => {
    for (const action of ['suspend', 'revoke', 'close', 'expire']) {
      const s = await source(`worker-${action}`), w = make({ async capture() { throw new Error('Must never start'); } }), [claim] = await w.claim(s.tenantId);
      if (action === 'suspend') await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`);
      if (action === 'revoke') await h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${h.user('A1')}`);
      if (action === 'expire') await h.owned(tx => tx`UPDATE gcms_s04.lead SET expires_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`);
      if (action === 'close') { const lead = (await h.page(s)).value.items[0]; expect((await h.command(s, await h.detail(s, lead.id), { kind: 'close', reason: 'spam' })).status).toBe(200); }
      expect(await w.process(claim)).toBe('skipped');
      const row = (await state(s))[0], deliveries = row.deliveries as Array<{ attempts: number }>;
      expect(deliveries[0].attempts).toBe(0); expect(row.status).toBe(action === 'close' ? 'cancelled' : action === 'expire' ? 'failed' : 'blocked');
    }
  });
});
