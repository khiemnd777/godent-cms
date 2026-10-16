import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { LeadNotificationWorker } from '../src/worker/lead-worker';
import { LocalLeadCapture, PermanentCaptureFailure } from '../src/worker/local-capture';
import { S05_ROUTES, type LeadCommandResult, type LeadHistoryPage, type RecipientSettings } from '../src/contracts/s05';
import { S05Harness } from './s05-support';

const h = new S05Harness();
async function startApi() {
  const runtime = await loadRuntimeEnvironment(), child = Bun.spawn([process.execPath, '--no-env-file', 'apps/api/test/s04-restart-server.ts'], { env: runtime.api, stdout: 'pipe', stderr: 'pipe' });
  const reader = child.stdout.getReader(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const next = await Promise.race([reader.read(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Owned API readiness timeout')), 12000); })]);
    if (next.done) throw new Error('Owned API stopped before readiness');
    const row = JSON.parse(new TextDecoder().decode(next.value).split('\n').find(line => line.startsWith('{')) ?? '{}') as { url?: string };
    if (!row.url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(row.url)) throw new Error('Unexpected owned API URL');
    return { child, url: row.url };
  } catch (error) { child.kill('SIGTERM'); await child.exited; throw error; }
  finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}

describe.skipIf(process.env.S05_INTEGRATION !== '1')('S05 real permission races, response loss and restart replay', () => {
  beforeAll(() => h.setup(), 120000); afterAll(() => h.close());
  test('a lost HTTP response followed by actual API process restart replays one durable command', async () => {
    const s = await h.source('response-loss'), lead = await h.intake(s), c = h.clients.get('A1')!, operationId = randomUUID();
    const body = { operationId, expectedVersion: 1, kind: 'note', text: 'One durable response-loss note' }, headers = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', cookie: c.signed.headers.get('cookie') ?? '', 'content-type': 'application/json', 'x-csrf-token': c.csrf };
    const first = await startApi(); let backendStatus = 0, committed!: () => void, releaseProxy!: () => void;
    const commitBarrier = new Promise<void>(resolve => { committed = resolve; }), holdResponse = new Promise<void>(resolve => { releaseProxy = resolve; });
    const proxy = createServer(async (request, response) => {
      request.resume(); const upstream = await fetch(first.url + S05_ROUTES.commands(s.tenantId, lead.id), { method: 'POST', headers, body: JSON.stringify(body) });
      backendStatus = upstream.status; await upstream.arrayBuffer(); committed();
      // No response is completed for this client. A client-side timeout/cancel
      // occurs only after the upstream API has durably committed the command.
      await holdResponse; response.destroy();
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('Owned proxy address absent');
      const controller = new AbortController();
      const pending = fetch(`http://127.0.0.1:${address.port}`, { method: 'POST', body: JSON.stringify(body), signal: controller.signal }).then(response => response.arrayBuffer());
      await commitBarrier; controller.abort();
      let lost = false; try { await pending; } catch { lost = true; }
      expect(lost).toBe(true); expect(controller.signal.aborted).toBe(true); expect(backendStatus).toBe(200);
    } finally { releaseProxy(); proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); first.child.kill('SIGTERM'); await first.child.exited; }
    const restarted = await startApi();
    try {
      const response = await fetch(restarted.url + S05_ROUTES.commands(s.tenantId, lead.id), { method: 'POST', headers, body: JSON.stringify(body) });
      expect(response.status).toBe(200); const result = await response.json() as LeadCommandResult;
      expect(result.replayed).toBe(true); expect(result.appliedVersion).toBe(2); expect(result.lead.version).toBe(2);
      const history = await h.call<LeadHistoryPage>(S05_ROUTES.history(s.tenantId, lead.id)); expect(history.value.items).toHaveLength(1);
    } finally { restarted.child.kill('SIGTERM'); await restarted.child.exited; }
  }, 120000);
  test('actual assign/revoke concurrency preserves current eligibility and pooled tenant isolation', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const s = await h.source(`assign-revoke-${attempt}`), lead = await h.intake(s);
      const [assign] = await Promise.all([h.command(s, lead, { kind: 'assign', assigneeUserId: h.user('A2') }),
        h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${h.user('A2')}`)]);
      expect([200, 409]).toContain(assign.status); const current = await h.detail(s, lead.id);
      if (assign.status === 200) { expect(current.assignee?.userId).toBe(h.user('A2')); expect(current.assignee?.eligible).toBe(false); }
      else { expect(assign.value.code).toBe('ASSIGNEE_UNAVAILABLE'); expect(current.assignee).toBeNull(); }
      const results = await Promise.all(Array.from({ length: 12 }, (_, index) => h.call(S05_ROUTES.lead(s.tenantId, lead.id), 'GET', undefined, index % 2 ? 'A1' : 'B1')));
      expect(results.map(r => r.status)).toEqual(Array.from({ length: 12 }, (_, index) => index % 2 ? 200 : 403));
    }
  });
  test('recipient settings reject a six-minute session without recent reauth, then accept actual password-only reauth', async () => {
    const s = await h.source('stale-reauth'), client = h.clients.get('A1')!, sessionId = client.signed.actor.sessionId;
    const original = await h.owned(tx => tx`SELECT created_at FROM gcms_s02_auth.session WHERE id=${sessionId}`);
    const path = S05_ROUTES.settings(s.tenantId), settings = (await h.call<RecipientSettings>(path)).value;
    const body = { operationId: randomUUID(), expectedVersion: settings.version, mode: 'selected', recipientUserIds: [h.user('A2')] };
    try {
      await h.owned(async tx => { await tx`UPDATE gcms_s02_auth.session SET created_at=clock_timestamp()-interval '6 minutes' WHERE id=${sessionId}`; await tx`DELETE FROM gcms_s02_auth.reauth_grant WHERE session_id=${sessionId}`; });
      const denied = await h.call(path, 'PUT', body); expect(denied.status).toBe(403); expect(denied.value.code).toBe('REAUTH_REQUIRED');
      const fixture = client.signed.fixture;
      expect((await h.call('/api/session/reauth', 'POST', { password: fixture.password })).status).toBe(200);
      expect((await h.call(path, 'PUT', body)).status).toBe(200);
    } finally { await h.owned(tx => tx`UPDATE gcms_s02_auth.session SET created_at=${original[0].created_at} WHERE id=${sessionId}`); }
  });
  test('permission loss after initiation cannot recall settled capture, and blocks future attempts', async () => {
    for (const action of ['suspend', 'revoke', 'disable']) {
      const s = await h.source(`after-start-${action}`); await h.intake(s); let recipient = h.user('A1');
      if (action === 'disable') {
        recipient = randomUUID(); await h.owned(async tx => {
          await tx`INSERT INTO gcms_s02_auth."user"(id,name,email,email_verified,two_factor_enabled,active) VALUES(${recipient},'S05 Owned Recipient',${`recipient-${recipient}@s05.example.invalid`},true,true,true)`;
          await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${s.tenantId},${recipient})`;
        });
        const path = S05_ROUTES.settings(s.tenantId), settings = (await h.call<RecipientSettings>(path)).value;
        expect((await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: settings.version, mode: 'selected', recipientUserIds: [recipient] })).status).toBe(200);
      }
      await h.owned(tx => tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`);
      const directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), capture = new LocalLeadCapture(join(directory, 'capture'));
      let started!: () => void, release!: () => void; const ready = new Promise<void>(resolve => { started = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
      const worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, { async capture(message) { started(); await gate; await capture.capture(message); } });
      try {
        const [claim] = await worker.claim(s.tenantId), active = worker.process(claim); await ready;
        if (action === 'suspend') await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`);
        if (action === 'revoke') await h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${recipient}`);
        if (action === 'disable') expect((await h.call(`/api/platform/users/${recipient}/disable`, 'POST', {}, 'PlatformOnly')).status).toBe(200);
        release(); expect(await active).toBe('captured'); expect(await readdir(join(directory, 'capture'))).toHaveLength(1);
        expect((await worker.runOnce(s.tenantId)).claimed).toBe(0);
        const rows = await h.owned(tx => tx`SELECT status,attempts FROM gcms_s05.delivery WHERE tenant_id=${s.tenantId}`); expect(rows[0]).toMatchObject({ status: 'captured', attempts: 1 });
      } finally { release?.(); await worker.close(); }
    }
  });
  test('mixed per-recipient success and permanent failure is terminal', async () => {
    const s = await h.source('mixed-terminal'); await h.intake(s);
    const path = S05_ROUTES.settings(s.tenantId), settings = (await h.call<RecipientSettings>(path)).value;
    expect((await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: settings.version, mode: 'selected', recipientUserIds: [h.user('A1'), h.user('A2')] })).status).toBe(200);
    await h.owned(tx => tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`);
    const directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), capture = new LocalLeadCapture(join(directory, 'capture'));
    const worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, { async capture(message) {
      if (message.recipientEmail === h.prior.identities.find(i => i.label === 'A2')!.email) throw new PermanentCaptureFailure('Owned recipient failure'); await capture.capture(message);
    } });
    try {
      const result = await worker.runOnce(s.tenantId); expect(result.captured).toBe(1); expect(result.failed).toBe(1);
      expect((await h.owned(tx => tx`SELECT status FROM gcms_s04.notification_intent WHERE tenant_id=${s.tenantId}`))[0].status).toBe('failed');
    } finally { await worker.close(); }
  });
  test('a recipient removed before start can be reselected while another delivery remains unfinished', async () => {
    const s = await h.source('recipient-reselect'); await h.intake(s);
    const path = S05_ROUTES.settings(s.tenantId);
    async function selected(ids: string[]) {
      const current = (await h.call<RecipientSettings>(path)).value;
      expect((await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: current.version, mode: 'selected', recipientUserIds: ids })).status).toBe(200);
    }
    await selected([h.user('A1'), h.user('A2')]);
    await h.owned(tx => tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`);
    const directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, new LocalLeadCapture(join(directory, 'capture')));
    try {
      const claims = await worker.claim(s.tenantId), rows = await h.owned(tx => tx`SELECT id,recipient_user_id FROM gcms_s05.delivery WHERE tenant_id=${s.tenantId}`) as Array<{ id: string; recipient_user_id: string }>;
      const a = claims.find(c => c.id === rows.find(r => r.recipient_user_id === h.user('A1'))!.id)!;
      const b = claims.find(c => c.id === rows.find(r => r.recipient_user_id === h.user('A2'))!.id)!;
      await selected([h.user('A1')]); expect(await worker.process(b)).toBe('skipped');
      await h.owned(tx => tx`UPDATE gcms_s04.notification_intent SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`);
      await worker.claim(s.tenantId);
      expect((await h.owned(tx => tx`SELECT status,failure_reason FROM gcms_s05.delivery WHERE id=${b.id}`))[0]).toMatchObject({ status: 'cancelled', failure_reason: 'recipient_changed' });
      await selected([h.user('A1'), h.user('A2')]);
      await h.owned(async tx => {
        await tx`UPDATE gcms_s05.delivery SET available_at=clock_timestamp()-interval '1 second' WHERE id=${b.id}`;
        await tx`UPDATE gcms_s04.notification_intent SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`;
      });
      const replacement = (await worker.claim(s.tenantId)).find(c => c.id === b.id)!; expect(replacement).toBeDefined();
      expect(await worker.process(replacement)).toBe('captured'); expect(await worker.process(a)).toBe('captured');
      expect(await readdir(join(directory, 'capture'))).toHaveLength(2);
    } finally { await worker.close(); }
  });
  test('a new owned recipient disabled after claim is denied before attempt initiation', async () => {
    const s = await h.source('before-start-disable'); await h.intake(s); const recipient = randomUUID();
    await h.owned(async tx => {
      await tx`INSERT INTO gcms_s02_auth."user"(id,name,email,email_verified,two_factor_enabled,active) VALUES(${recipient},'S05 Owned Prestart Recipient',${`prestart-${recipient}@s05.example.invalid`},true,true,true)`;
      await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${s.tenantId},${recipient})`;
      await tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${s.tenantId},true)`;
    });
    const path = S05_ROUTES.settings(s.tenantId), current = (await h.call<RecipientSettings>(path)).value;
    expect((await h.call(path, 'PUT', { operationId: randomUUID(), expectedVersion: current.version, mode: 'selected', recipientUserIds: [recipient] })).status).toBe(200);
    const directory = await mkdtemp('/private/tmp/gcms-s05-worker-'), worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, new LocalLeadCapture(join(directory, 'capture')));
    try {
      const [claim] = await worker.claim(s.tenantId);
      expect((await h.call(`/api/platform/users/${recipient}/disable`, 'POST', {}, 'PlatformOnly')).status).toBe(200);
      expect(await worker.process(claim)).toBe('skipped'); expect(await readdir(directory)).toHaveLength(0);
      const rows = await h.owned(tx => tx`SELECT status,attempts FROM gcms_s05.delivery WHERE tenant_id=${s.tenantId}`); expect(rows[0]).toMatchObject({ status: 'blocked', attempts: 0 });
    } finally { await worker.close(); }
  });
});
