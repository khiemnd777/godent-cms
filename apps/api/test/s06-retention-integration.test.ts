import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { S05_ROUTES, type LeadCommandResult, type LeadCount, type LeadHistoryPage, type LeadPage } from '../src/contracts/s05';
import { S06_ROUTES } from '../src/contracts/s06';
import { RetentionWorker } from '../src/worker/retention-worker';
import { RetentionCapture } from '../src/worker/retention-capture';
import { PermanentCaptureFailure, type LeadCaptureTransport } from '../src/worker/local-capture';
import { postgresCode } from '../src/database';
import { S05Harness } from './s05-support';

const h = new S05Harness(), workers: RetentionWorker[] = [], ownedTenants: string[] = [];
let raw: SQL;
function worker(transport?: LeadCaptureTransport) { const w = new RetentionWorker(process.env.S06_WORKER_DATABASE_URL!, transport); workers.push(w); return w; }
async function source(label: string, seconds = 6 * 86400) {
  const s = await h.source(`m2-s06-${label}`), lead = await h.intake(s, { name: 'M2 Synthetic retained lead', message: `private-message-${h.run}` });
  ownedTenants.push(s.tenantId); console.info(JSON.stringify({ scope: 'S06_NEW_OWNED_FIXTURE', run: h.run, tenantId: s.tenantId }));
  await h.owned(async tx => {
    await tx`INSERT INTO gcms_s06.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`;
    await tx`INSERT INTO gcms_s06.audit_retention_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`;
    await tx`INSERT INTO gcms_s06.lead_scope VALUES(${s.tenantId},${lead.id})`;
  });
  await expireIn(s.tenantId, lead.id, seconds);
  return { ...s, lead: await h.detail(s, lead.id) };
}
async function expireIn(tenant: string, lead: string, seconds: number) {
  await h.owned(tx => tx`WITH instant AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=i.at-interval '200 days',consent_at=i.at-interval '200 days',
    last_activity_at=i.at-interval '180 days'+${seconds}*interval '1 second' FROM instant i WHERE tenant_id=${tenant} AND id=${lead}`);
}
async function extension(s: Awaited<ReturnType<typeof source>>, expectedVersion = s.lead.version, changes: Record<string, unknown> = {}, label = 'A1') {
  return h.call<LeadCommandResult & { code?: string }>(S06_ROUTES.extension(s.tenantId, s.lead.id), 'POST', {
    expectedVersion, operationId: randomUUID(), reason: 'Synthetic follow-up agreed', expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), ...changes,
  }, label);
}

describe.skipIf(process.env.S06_INTEGRATION !== '1')('S06 actual PostgreSQL retention, authorization and restricted worker', () => {
  beforeAll(async () => { await h.setup(); raw = new SQL(process.env.S06_WORKER_DATABASE_URL!, { max: 3, connectionTimeout: 3 }); }, 120000);
  afterAll(async () => { console.info(JSON.stringify({ scope: 'S06_NEW_OWNED_FIXTURES', run: h.run, tenantIds: ownedTenants, cleanupPerformed: false })); await Promise.all(workers.map(w => w.close())); await raw?.close(); await h.close(); });
  test('D4 contact180, closed90, spam30 and non-substantive commands preserve normal deadlines', async () => {
    const s = await source('d4-contact');
    await h.owned(tx => tx`WITH instant AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=i.at-interval '150 days',consent_at=i.at-interval '150 days',last_activity_at=i.at-interval '150 days' FROM instant i WHERE tenant_id=${s.tenantId} AND id=${s.lead.id}`);
    const before = await h.detail(s, s.lead.id), contacted = await h.command(s, before, { kind: 'contact', channel: 'phone', outcome: 'two_way', summary: 'Synthetic two-way contact' });
    expect(contacted.status).toBe(200);
    const current = await h.detail(s, s.lead.id); expect((Date.parse(current.normalExpiresAt) - Date.parse(current.createdAt)) / 86400000).toBeCloseTo(330, 3);
    expect((await h.command(s, current, { kind: 'note', text: 'Ordinary note does not renew retention' })).status).toBe(200);
    expect((await h.detail(s, s.lead.id)).normalExpiresAt).toBe(current.normalExpiresAt);
    const closed = await source('d4-close');
    await h.owned(tx => tx`WITH instant AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=i.at-interval '160 days',consent_at=i.at-interval '160 days',last_activity_at=i.at-interval '10 days',has_contact_attempt=true,has_two_way_contact=true,status='contacted' FROM instant i WHERE tenant_id=${closed.tenantId} AND id=${closed.lead.id}`);
    expect((await h.command(closed, await h.detail(closed, closed.lead.id), { kind: 'close', reason: 'completed' })).status).toBe(200);
    const final = await h.detail(closed, closed.lead.id); expect((Date.parse(final.normalExpiresAt) - Date.parse(final.createdAt)) / 86400000).toBeCloseTo(250, 3);
    expect((await h.command(closed, final, { kind: 'reopen', reason: 'Synthetic reopened request' })).status).toBe(200);
    expect((await h.detail(closed, closed.lead.id)).normalExpiresAt).toBe(final.normalExpiresAt);
    const spam = await source('d4-spam', 100 * 86400);
    expect((await h.command(spam, spam.lead, { kind: 'close', reason: 'spam' })).status).toBe(200);
    const discarded = await h.detail(spam, spam.lead.id); expect((Date.parse(discarded.normalExpiresAt) - Date.parse(discarded.closedAt!)) / 86400000).toBeCloseTo(30, 3);
  });
  test('extension is current-authorized, replay-safe and independent from normal activity', async () => {
    const s = await source('extend'), operationId = randomUUID(), expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
    const denied = await extension(s, 1, {}, 'B1'); expect(denied.status).toBe(403);
    expect((await extension(s, 1, {}, 'PlatformOnly')).status).toBe(403);
    const client = h.clients.get('A1')!;
    const csrf = await h.call(S06_ROUTES.extension(s.tenantId, s.lead.id), 'POST', {}, 'A1', { 'x-csrf-token': 'invalid' }); expect(csrf.status).toBe(403);
    const original = await h.owned(tx => tx`SELECT created_at FROM gcms_s02_auth.session WHERE id=${client.signed.actor.sessionId}`);
    try {
      await h.owned(async tx => { await tx`UPDATE gcms_s02_auth.session SET created_at=clock_timestamp()-interval '6 minutes' WHERE id=${client.signed.actor.sessionId}`; await tx`DELETE FROM gcms_s02_auth.reauth_grant WHERE session_id=${client.signed.actor.sessionId}`; });
      const stale = await extension(s); expect(stale.status).toBe(403); expect(stale.value.code).toBe('REAUTH_REQUIRED');
      expect((await h.call('/api/session/reauth', 'POST', { password: client.signed.fixture.password })).status).toBe(200);
    } finally { await h.owned(tx => tx`UPDATE gcms_s02_auth.session SET created_at=${original[0].created_at} WHERE id=${client.signed.actor.sessionId}`); }
    const first = await extension(s, 1, { operationId, expiresAt }); expect(first.status).toBe(200); expect(first.value.lead.expiresAt).toBe(expiresAt);
    expect(first.value.lead.normalExpiresAt).toBe(s.lead.normalExpiresAt); expect(first.value.lead.lastActivityAt).toBe(s.lead.lastActivityAt); expect(first.value.lead.retentionRevision).toBe(s.lead.retentionRevision + 1);
    const replay = await extension(s, 1, { operationId, expiresAt }); expect(replay.status).toBe(200); expect(replay.value.replayed).toBe(true); expect(replay.value.lead.version).toBe(2);
    expect((await extension(s, 1, { operationId, expiresAt, reason: 'Different command' })).value.code).toBe('OPERATION_CONFLICT');
    expect((await extension(s, 1)).value.code).toBe('VERSION_CONFLICT');
    const contact = await h.command(s, first.value.lead, { kind: 'contact', channel: 'phone', outcome: 'unanswered', summary: 'Attempted contact' }); expect(contact.status).toBe(200);
    const current = await h.detail(s, s.lead.id); expect(current.expiresAt).toBe(expiresAt); expect(Date.parse(current.normalExpiresAt)).toBeLessThan(Date.parse(expiresAt));
    const history = (await h.call<LeadHistoryPage>(S05_ROUTES.history(s.tenantId, s.lead.id))).value;
    expect(history.items.filter(e => e.kind === 'retention_extended')).toHaveLength(1);
    await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`);
    expect((await extension(s, current.version)).status).toBe(403); expect((await h.call(S05_ROUTES.lead(s.tenantId, s.lead.id))).status).toBe(200);
  });
  test('notice reaches all current eligible administrators during suspension and stale revisions cannot dispatch', async () => {
    const s = await source('notices'), directory = await mkdtemp('/private/tmp/gcms-s06-notice-'), capture = new RetentionCapture(join(directory, 'capture'));
    await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`);
    const w = worker(capture); const result = await w.runOnce(s.tenantId); expect(result.captured).toBe(2); expect(result.deleted).toBe(0);
    expect(await readdir(join(directory, 'capture'))).toHaveLength(2);
    for (const file of await readdir(join(directory, 'capture'))) { const value = await readFile(join(directory, 'capture', file), 'utf8'); expect(value).not.toContain(s.lead.id); expect(value).not.toContain('private-message'); expect(value).not.toContain('0900123456'); }
    expect((await h.detail(s, s.lead.id)).retentionNotice.status).toBe('captured');
    const other = await source('stale-notice'), stale = await w.claim(other.tenantId); expect(stale).toHaveLength(2);
    expect((await extension(other)).status).toBe(200);
    for (const claim of stale) expect(await w.process(claim)).toBe('skipped');
    expect((await w.runOnce(other.tenantId)).claimed).toBe(0);
  });
  test('history timing follows current effective expiry after another administrator shortens or extends retention', async () => {
    const s = await source('history-timing', 100 * 86400), path = S05_ROUTES.history(s.tenantId, s.lead.id), started = Date.now();
    const original = await h.call<LeadHistoryPage>(path);
    expect(original.status).toBe(200); expect(original.value.validUntil).toBe(s.lead.expiresAt);
    expect(Date.parse(original.value.serverTime)).toBeGreaterThanOrEqual(started - 1000); expect(Date.parse(original.value.serverTime)).toBeLessThanOrEqual(Date.now() + 1000);
    const closed = await h.command(s, s.lead, { kind: 'close', reason: 'spam' }, 'A2'); expect(closed.status).toBe(200);
    const shortened = await h.detail(s, s.lead.id), current = await h.call<LeadHistoryPage>(path);
    expect(Date.parse(shortened.expiresAt)).toBeLessThan(Date.parse(s.lead.expiresAt));
    expect(current.status).toBe(200); expect(current.value.validUntil).toBe(shortened.expiresAt); expect(current.value.items[0].kind).toBe('close');
    expect(Date.parse(current.value.serverTime)).toBeGreaterThanOrEqual(Date.parse(original.value.serverTime));
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString(), extended = await extension(s, shortened.version, { expiresAt: expiry }, 'A2');
    expect(extended.status).toBe(200);
    const afterExtension = await h.call<LeadHistoryPage>(path);
    expect(afterExtension.value.validUntil).toBe(expiry); expect(afterExtension.value.validUntil).not.toBe(extended.value.lead.normalExpiresAt);
    expect(afterExtension.value.items[0].kind).toBe('retention_extended');
    await h.owned(tx => tx`UPDATE gcms_s04.lead SET extension_expires_at=NULL WHERE tenant_id=${s.tenantId} AND id=${s.lead.id}`);
    await expireIn(s.tenantId, s.lead.id, -1);
    expect((await h.call(path)).status).toBe(404);
  });
  test('expiry removes every read/count/history/command and deletion removes private payloads atomically', async () => {
    const s = await source('delete'), note = await h.command(s, s.lead, { kind: 'note', text: `private-note-${h.run}` }); expect(note.status).toBe(200);
    const ext = await extension(s, 2, { expiresAt: new Date(Date.now() + 8 * 86400000).toISOString() }); expect(ext.status).toBe(200);
    // A newly owned synthetic fixture controls its extension and activity boundary.
    await h.owned(tx => tx`UPDATE gcms_s04.lead SET extension_expires_at=NULL WHERE tenant_id=${s.tenantId} AND id=${s.lead.id}`);
    await expireIn(s.tenantId, s.lead.id, -1);
    const backup = (await h.owned(tx => tx`SELECT to_jsonb(l) AS value FROM gcms_s04.lead l WHERE tenant_id=${s.tenantId} AND id=${s.lead.id}`))[0].value;
    expect((await h.call(S05_ROUTES.lead(s.tenantId, s.lead.id))).status).toBe(404);
    expect((await h.call(S05_ROUTES.history(s.tenantId, s.lead.id))).status).toBe(404);
    expect((await h.call<LeadPage>(S05_ROUTES.leads(s.tenantId))).value.items).toHaveLength(0);
    expect((await h.call<LeadCount>(S05_ROUTES.count(s.tenantId))).value.count).toBe(0);
    const direct = await h.db.withLeadTenant(h.clients.get('A1')!.signed.actor, s.tenantId, tx => tx.execute(sql`SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`));
    expect(direct).toHaveLength(0);
    expect((await extension(s, 3)).value.code).toBe('LEAD_UNAVAILABLE');
    const w = worker(), [claim] = await w.claim(s.tenantId); expect(claim.kind).toBe('delete');
    // Fault after physical DML, before commit: the same transaction rolls all graph writes back.
    let rollback = false;
    try { await h.owned(async tx => { expect((await tx`SELECT gcms_s06.worker_delete(${s.tenantId},${claim.id},${w.workerId},${claim.fence}) AS value`)[0].value).toBe(true); throw new Error('owned precommit fault'); }); } catch (error) { rollback = error instanceof Error && error.message === 'owned precommit fault'; }
    expect(rollback).toBe(true);
    expect((await h.owned(tx => tx`SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`))).toHaveLength(1);
    expect((await h.owned(tx => tx`SELECT * FROM gcms_s06.deletion_decision WHERE tenant_id=${s.tenantId}`))).toHaveLength(0);
    expect(await w.process(claim)).toBe('deleted');
    for (const table of ['gcms_s04.lead', 'gcms_s04.accepted_request', 'gcms_s04.intake_activity', 'gcms_s04.notification_intent', 'gcms_s05.lead_event', 'gcms_s05.operation_receipt', 'gcms_s05.delivery', 'gcms_s06.extension_receipt', 'gcms_s06.job', 'gcms_s06.notice']) {
      const rows = await h.owned(tx => tx.unsafe(`SELECT count(*)::integer AS n FROM ${table} WHERE tenant_id=$1`, [s.tenantId])); expect(rows[0].n).toBe(0);
    }
    const decisions = await h.owned(tx => tx`SELECT to_jsonb(d) AS value FROM gcms_s06.deletion_decision d WHERE tenant_id=${s.tenantId}`); expect(decisions).toHaveLength(1);
    expect(Object.keys(decisions[0].value).sort()).toEqual(['deleted_at', 'expired_at', 'lead_id', 'retention_revision', 'tenant_id']);
    const audit = await h.owned(tx => tx`SELECT to_jsonb(a) AS value FROM gcms_s06.audit_event a WHERE tenant_id=${s.tenantId}`); expect(JSON.stringify(audit)).not.toContain('private-');
    let restoreCode: string | undefined, restoreMessage = '';
    try { await h.owned(tx => tx`INSERT INTO gcms_s04.lead SELECT (jsonb_populate_record(NULL::gcms_s04.lead,${JSON.stringify(backup)}::text::jsonb)).*`); }
    catch (error) { restoreCode = postgresCode(error); restoreMessage = error instanceof Error ? error.message : ''; }
    expect(restoreCode).toBe('23514'); expect(restoreMessage).toContain('Deleted lead identity denied');
    expect((await h.owned(tx => tx`SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} AND id=${s.lead.id}`))).toHaveLength(0);
    expect((await w.runOnce(s.tenantId)).deleted).toBe(0);
  });
  test('restricted scope, fencing, two workers and expired stale claims preserve deletion decisions', async () => {
    const w = worker(); await w.verifyRole();
    for (const statement of ['SELECT * FROM gcms_s04.lead', 'SELECT * FROM gcms_s02_auth."user"', 'DELETE FROM gcms_s06.deletion_decision']) {
      let denied = false; try { await raw.unsafe(statement); } catch (error) { denied = postgresCode(error) === '42501'; } expect(denied).toBe(true);
    }
    await expect(w.claim(randomUUID())).rejects.toThrow();
    const s = await source('fences'), other = worker();
    const [first, second] = await Promise.all([w.claim(s.tenantId), other.claim(s.tenantId)]);
    expect(new Set([...first, ...second].map(c => c.id)).size).toBe(first.length + second.length);
    const stale = [...first, ...second][0]; expect(stale).toBeDefined();
    const ownerId = first.some(c => c.id === stale.id) ? w.workerId : other.workerId;
    expect((await raw`SELECT gcms_s06.worker_notice_start(${s.tenantId},${stale.id},${ownerId},NULL) AS value`)[0].value).toBeNull();
    await h.owned(tx => tx`UPDATE gcms_s06.job SET lease_until=clock_timestamp()-interval '1 second',available_at=clock_timestamp()-interval '1 second' WHERE id=${stale.id}`);
    const [fresh] = await other.claim(s.tenantId); expect(fresh.fence).toBeGreaterThan(stale.fence);
    expect((await raw`SELECT gcms_s06.worker_notice_finish(${s.tenantId},${stale.id},${ownerId},${stale.fence},'captured') AS value`)[0].value).toBe(false);
    expect((await raw`SELECT gcms_s06.worker_notice_start(${s.tenantId},${stale.id},${ownerId},${stale.fence}) AS value`)[0].value).toBeNull();
  });
  test('concurrent extensions select one version and a stale deletion job cannot undo the winner', async () => {
    const s = await source('extension-race'), w = worker(), jobId = randomUUID();
    // A controlled cached deletion claim from an earlier scan/restore is deliberately stale.
    await h.owned(tx => tx`INSERT INTO gcms_s06.job(id,tenant_id,lead_id,revision,kind,recipient_id,status,worker_id,fence,attempts,lease_until)
      VALUES(${jobId},${s.tenantId},${s.lead.id},${s.lead.retentionRevision},'delete','system','processing',${w.workerId},1,1,clock_timestamp()+interval '30 seconds')`);
    const responses = await Promise.all([extension(s, 1), extension(s, 1, {}, 'A2')]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(responses.find(r => r.status === 409)!.value.code).toBe('VERSION_CONFLICT');
    expect(await w.process({ id: jobId, tenantId: s.tenantId, leadId: s.lead.id, revision: s.lead.retentionRevision, kind: 'delete', fence: 1 })).toBe('skipped');
    expect((await h.detail(s, s.lead.id)).version).toBe(2);
    expect((await h.owned(tx => tx`SELECT * FROM gcms_s06.deletion_decision WHERE tenant_id=${s.tenantId}`))).toHaveLength(0);
  });
  test('notice timing and positive per-lead scope preserve unselected synthetic backlog', async () => {
    const s = await source('scope', 8 * 86400), w = worker(); expect((await w.runOnce(s.tenantId)).claimed).toBe(0);
    const unselected = await h.intake(s, { name: 'Owned unselected backlog' });
    await expireIn(s.tenantId, unselected.id, -1); await expireIn(s.tenantId, s.lead.id, -1);
    const result = await w.runOnce(s.tenantId); expect(result.deleted).toBe(1);
    const kept = await h.owned(tx => tx`SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`); expect(kept.map((r: { id: string }) => r.id)).toEqual([unselected.id]);
    const decisions = await h.owned(tx => tx`SELECT lead_id FROM gcms_s06.deletion_decision WHERE tenant_id=${s.tenantId}`); expect(decisions.map((r: { lead_id: string }) => r.lead_id)).toEqual([s.lead.id]);
  });
  test('worker restart after actual process crashes reuses durable generic capture identity', async () => {
    for (const mode of ['before', 'after']) {
      const s = await source(`crash-${mode}`), directory = await mkdtemp('/private/tmp/gcms-s06-process-');
      const env: Record<string, string> = { S06_WORKER_DATABASE_URL: process.env.S06_WORKER_DATABASE_URL! };
      for (const key of ['PATH', 'HOME', 'TMPDIR']) if (process.env[key]) env[key] = process.env[key]!;
      const child = Bun.spawn([process.execPath, '--no-env-file', 'apps/api/test/s06-worker-process.ts', s.tenantId, directory, mode], { env, stdout: 'pipe', stderr: 'pipe' });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const exited = await Promise.race([child.exited, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Owned fault process timeout')), 12000); })]);
        expect(exited).toBe(mode === 'before' ? 31 : 32);
      } finally { if (timer) clearTimeout(timer); if (child.exitCode === null) { child.kill('SIGTERM'); await child.exited; } }
      const started = JSON.parse(await readFile(join(directory, 'started.json'), 'utf8')) as { deliveryId: string };
      await h.owned(tx => tx`UPDATE gcms_s06.job SET available_at=clock_timestamp()-interval '1 second',lease_until=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`);
      expect((await worker(new RetentionCapture(join(directory, 'capture'))).runOnce(s.tenantId)).captured).toBe(2);
      expect((await readdir(join(directory, 'capture'))).filter(name => name === `${started.deliveryId}.json`)).toHaveLength(1);
      expect((await h.detail(s, s.lead.id)).retentionNotice.status).toBe('captured');
    }
  }, 60000);
  test('unsettled capture retains its advisory lock after budget and controlled lease expiry', async () => {
    const s = await source('unsettled'), directory = await mkdtemp('/private/tmp/gcms-s06-held-'), capture = new RetentionCapture(join(directory, 'capture'));
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { started = resolve; });
    const a = worker({ async capture(message) { started(); await gate; await capture.capture(message); } }), b = worker(capture), [claim] = await a.claim(s.tenantId);
    const running = a.process(claim); await ready;
    try {
      await Bun.sleep(2100);
      await h.owned(tx => tx`UPDATE gcms_s06.job SET lease_until=clock_timestamp()-interval '1 second',available_at=clock_timestamp()-interval '1 second' WHERE id=${claim.id}`);
      expect(await b.claim(s.tenantId)).toHaveLength(0);
    } finally { release(); }
    expect(await running).toBe('captured');
    expect((await readdir(join(directory, 'capture')))).toHaveLength(1);
  });
  test('audit365 removes authenticated, anonymous, system and explicitly selected tenant-less events', async () => {
    const s = await source('audit'), global = randomUUID(), recent = randomUUID();
    await h.owned(async tx => {
      await tx`INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(${randomUUID()},${s.tenantId},${h.user('A1')},'synthetic.old',${s.lead.id},clock_timestamp()-interval '366 days'),(${global},NULL,${h.user('A1')},'synthetic.global',${s.lead.id},clock_timestamp()-interval '366 days'),(${recent},${s.tenantId},${h.user('A1')},'synthetic.recent',${s.lead.id},clock_timestamp()-interval '364 days')`;
      await tx`INSERT INTO gcms_s06.audit_scope VALUES(${s.tenantId},'s02',${global})`;
      await tx`UPDATE gcms_s04.audit_event SET created_at=clock_timestamp()-interval '366 days' WHERE tenant_id=${s.tenantId}`;
      await tx`INSERT INTO gcms_s06.audit_event(tenant_id,event,target_id,created_at) VALUES(${s.tenantId},'lead.deleted',${randomUUID()},clock_timestamp()-interval '366 days')`;
    });
    const result = await worker().expireAudit(s.tenantId); expect(result).toEqual({ authenticated: 2, anonymous: 1, system: 1 });
    expect((await h.owned(tx => tx`SELECT id FROM gcms_s02.audit_event WHERE id=${recent}`))).toHaveLength(1);
    expect((await h.owned(tx => tx`SELECT id FROM gcms_s02.audit_event WHERE id=${global}`))).toHaveLength(0);
  });
  test('terminal capture failure does not postpone expiry and unavailable recipients are explicit', async () => {
    const s = await source('failure'), before = s.lead.expiresAt;
    const result = await worker({ async capture() { throw new PermanentCaptureFailure('owned capture fault'); } }).runOnce(s.tenantId); expect(result.failed).toBe(2);
    expect((await h.detail(s, s.lead.id)).retentionNotice.status).toBe('failed'); expect((await h.detail(s, s.lead.id)).expiresAt).toBe(before);
    const blocked = await source('blocked'), recipient = randomUUID();
    await h.owned(async tx => {
      await tx`INSERT INTO gcms_s02_auth."user"(id,name,email,email_verified,active) VALUES(${recipient},'S06 Owned recipient',${`retention-${recipient}@s06.example.invalid`},true,true)`;
      await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${blocked.tenantId},${recipient})`;
      // Preserve the last-admin guard. Only the newly owned account changes eligibility.
      await tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${blocked.tenantId} AND user_id<>${recipient}`;
      await tx`UPDATE gcms_s02_auth."user" SET email_verified=false WHERE id=${recipient}`;
    });
    expect((await worker().runOnce(blocked.tenantId)).claimed).toBe(0);
    expect((await h.owned(tx => tx`SELECT status,blocked_reason FROM gcms_s06.notice WHERE tenant_id=${blocked.tenantId}`))[0]).toMatchObject({ status: 'blocked', blocked_reason: 'recipient_unavailable' });
  });
});
