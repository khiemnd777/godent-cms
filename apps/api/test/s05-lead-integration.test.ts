import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { postgresCode } from '../src/database';
import { LeadsService } from '../src/modules/leads.service';
import { S05_ROUTES, type LeadCommandResult, type LeadCount, type LeadDetail, type LeadHistoryPage, type RecipientSettings } from '../src/contracts/s05';
import { S05Harness } from './s05-support';

const h = new S05Harness();
describe.skipIf(process.env.S05_INTEGRATION !== '1')('S05 actual HTTP/PostgreSQL lead operations', () => {
  beforeAll(() => h.setup(), 120000); afterAll(() => h.close());
  test('real intake assignment is shared, versioned and retry-safe, with append-only history', async () => {
    const s = await h.source('assignment'), lead = await h.intake(s), operationId = randomUUID();
    expect(lead.code).toBe('YC-000001'); expect(lead.version).toBe(1);
    const body = { kind: 'assign', assigneeUserId: h.user('A2'), expectedVersion: 1, operationId };
    const result = await h.call<LeadCommandResult>(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', body); expect(result.status).toBe(200);
    expect(result.value.lead.status).toBe('assigned'); expect(result.value.lead.assignee?.userId).toBe(h.user('A2'));
    const retry = await h.call<LeadCommandResult>(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', body); expect(retry.value.replayed).toBe(true); expect(retry.value.appliedVersion).toBe(2);
    const changed = await h.call(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', { ...body, assigneeUserId: null }); expect(changed.status).toBe(409); expect(changed.value.code).toBe('OPERATION_CONFLICT');
    for (const who of ['A1', 'A2']) {
      const detail = await h.call<LeadDetail>(S05_ROUTES.lead(s.tenantId, lead.id), 'GET', undefined, who); expect(detail.value.version).toBe(2); expect(detail.value.lastActivityAt).toBe(lead.lastActivityAt);
      const history = await h.call<LeadHistoryPage>(S05_ROUTES.history(s.tenantId, lead.id), 'GET', undefined, who); expect(history.value.items).toHaveLength(1); expect(history.value.items[0].kind).toBe('assign');
    }
  });
  test('same-version competing commands apply once and rollback protects precommit failures', async () => {
    const s = await h.source('atomic'), lead = await h.intake(s);
    const race = await Promise.all(['A1', 'A2'].map(who => h.command(s, lead, { kind: 'note', text: who }, who)));
    expect(race.map(r => r.status).sort()).toEqual([200, 409]); expect((await h.detail(s, lead.id)).version).toBe(2);
    const service = new LeadsService(h.db, h.identity), c = h.clients.get('A1')!, before = await h.detail(s, lead.id);
    let failed = false;
    try {
      await h.db.withTenant(c.signed.actor, s.tenantId, async tx => {
        await tx.execute(sql`SELECT gcms_s05.lead_command(${s.tenantId},${lead.id},${JSON.stringify({ kind: 'note', text: 'must rollback', operationId: randomUUID(), expectedVersion: before.version })}::text::jsonb)`);
        throw new Error('Owned precommit fault');
      });
    } catch { failed = true; }
    expect(failed).toBe(true); expect((await h.detail(s, lead.id)).version).toBe(before.version);
    const detail = await service.detail({ method: 'GET', originalUrl: '', headers: { cookie: c.signed.headers.get('cookie') ?? '' } }, s.tenantId, lead.id); expect(detail.version).toBe(2);
  });
  test('notes do not renew retention; only real contact permits Contacted/completed and renews activity', async () => {
    const s = await h.source('retention'), lead = await h.intake(s);
    await h.owned(tx => tx`UPDATE gcms_s04.lead SET created_at=created_at-interval '150 days',consent_at=consent_at-interval '150 days',last_activity_at=last_activity_at-interval '150 days',expires_at=expires_at-interval '150 days' WHERE tenant_id=${s.tenantId}`);
    let current = await h.detail(s, lead.id); const old = current;
    const note = await h.command(s, current, { kind: 'note', text: '<script>literal</script> á' }); expect(note.status).toBe(200); current = await h.detail(s, lead.id);
    expect(current.expiresAt).toBe(old.expiresAt); expect(current.lastActivityAt).toBe(old.lastActivityAt);
    expect((await h.command(s, current, { kind: 'close', reason: 'completed' })).value.code).toBe('INVALID_TRANSITION');
    expect((await h.command(s, current, { kind: 'close', reason: 'unreachable' })).value.code).toBe('INVALID_TRANSITION');
    expect((await h.command(s, current, { kind: 'contact', channel: 'phone', outcome: 'unanswered', summary: 'Actual unanswered call' })).status).toBe(200);
    current = await h.detail(s, lead.id); expect(current.status).toBe('new'); expect(current.hasContactAttempt).toBe(true); expect(current.hasTwoWayContact).toBe(false);
    expect(Date.parse(current.expiresAt) - Date.parse(current.lastActivityAt)).toBe(180 * 86400000);
    expect(Date.parse(current.expiresAt) - Date.parse(current.createdAt)).toBeGreaterThan(329.99 * 86400000);
    expect((await h.command(s, current, { kind: 'contact', channel: 'phone', outcome: 'two_way', summary: 'Actual two-way conversation' })).status).toBe(200);
    current = await h.detail(s, lead.id); expect(current.status).toBe('contacted');
    // Advance the owned fixture's relative clock: activity day150, close server day160.
    await h.owned(tx => tx`WITH stamp AS (SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead SET created_at=stamp.at-interval '160 days',consent_at=stamp.at-interval '160 days',last_activity_at=stamp.at-interval '10 days',expires_at=stamp.at+interval '170 days' FROM stamp WHERE tenant_id=${s.tenantId}`);
    current = await h.detail(s, lead.id);
    expect((await h.command(s, current, { kind: 'close', reason: 'completed' })).status).toBe(200); current = await h.detail(s, lead.id);
    expect(current.status).toBe('closed'); expect(Math.round((Date.parse(current.expiresAt) - Date.parse(current.createdAt)) / 86400000)).toBe(250);
    const closedExpiry = current.expiresAt;
    expect((await h.command(s, current, { kind: 'assign', assigneeUserId: h.user('A2') })).value.code).toBe('INVALID_TRANSITION');
    expect((await h.command(s, current, { kind: 'reopen', reason: 'Continued real request' })).status).toBe(200); current = await h.detail(s, lead.id);
    expect(current.status).toBe('contacted'); expect(current.expiresAt).toBe(closedExpiry);
    const history = await h.call<LeadHistoryPage>(S05_ROUTES.history(s.tenantId, lead.id)); expect(history.value.items.some(e => e.kind === 'note' && e.payload.text.includes('<script>'))).toBe(true);
  });
  test('spam/duplicate closure needs no fabricated contact and reopening preserves the shorter deadline', async () => {
    const s = await h.source('early-close'), lead = await h.intake(s);
    expect((await h.command(s, lead, { kind: 'close', reason: 'spam' })).status).toBe(200); let current = await h.detail(s, lead.id);
    expect(current.hasContactAttempt).toBe(false); expect(Math.round((Date.parse(current.expiresAt) - Date.parse(current.closedAt!)) / 86400000)).toBe(30);
    const expiry = current.expiresAt; expect((await h.command(s, current, { kind: 'reopen', reason: 'Reviewed request' })).status).toBe(200); current = await h.detail(s, lead.id);
    expect(current.status).toBe('new'); expect(current.expiresAt).toBe(expiry); expect(current.notification.status).toBe('cancelled');
  });
  test('expiry/current rights precede replay, and all reads deny expired leads', async () => {
    const s = await h.source('expired'), lead = await h.intake(s), body = { kind: 'note', text: 'one', operationId: randomUUID(), expectedVersion: 1 };
    expect((await h.call(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', body)).status).toBe(200);
    await h.owned(tx => tx`UPDATE gcms_s04.lead SET expires_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`);
    expect((await h.call(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', body)).status).toBe(404);
    expect((await h.call(S05_ROUTES.lead(s.tenantId, lead.id))).status).toBe(404);
    expect((await h.call(S05_ROUTES.history(s.tenantId, lead.id))).status).toBe(404);
    expect((await h.page(s)).value.items).toHaveLength(0); expect((await h.call<LeadCount>(S05_ROUTES.count(s.tenantId))).value.count).toBe(0);
  });
  test('tenant isolation, suspended reads, CSRF and revoked assignees remain enforced', async () => {
    const s = await h.source('rights'), lead = await h.intake(s), path = S05_ROUTES.lead(s.tenantId, lead.id);
    for (const who of ['B1', 'PlatformOnly']) expect((await h.call(path, 'GET', undefined, who)).status).toBe(403);
    const anon = await fetch(h.base + path, { headers: { host: '127.0.0.1:5890' } }); expect(anon.status).toBe(401);
    expect((await h.call(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', { kind: 'note', text: 'CSRF denied', expectedVersion: 1, operationId: randomUUID() }, 'A1', { 'x-csrf-token': 'forged' })).status).toBe(403);
    await h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${h.user('A2')}`);
    expect((await h.command(s, lead, { kind: 'assign', assigneeUserId: h.user('A2') })).value.code).toBe('ASSIGNEE_UNAVAILABLE');
    await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`);
    expect((await h.call<LeadDetail>(path)).value.capabilities).toEqual({ canWrite: false, reason: 'tenant_suspended' });
    expect((await h.call(S05_ROUTES.history(s.tenantId, lead.id))).status).toBe(200);
    expect((await h.call(S05_ROUTES.assignees(s.tenantId))).status).toBe(200);
    expect((await h.command(s, lead, { kind: 'note', text: 'denied' })).status).toBe(403);
    let denied = false; try { await h.db.tenantDb.execute(sql`UPDATE gcms_s04.lead SET name='forged' WHERE tenant_id=${s.tenantId}`); } catch (error) { denied = postgresCode(error) === '42501'; } expect(denied).toBe(true);
  });
  test('search is literal substring with diacritics, and stable cursor/count stay tenant scoped at 10000 rows', async () => {
    const s = await h.source('query'), lead = await h.intake(s); await h.bulk(s, 10000);
    const count = await h.call<LeadCount>(S05_ROUTES.count(s.tenantId)); expect(count.value).toEqual({ count: 10000, capped: true, newCount: 10000, newCapped: true });
    expect((await h.page(s, '?q=H%E1%BA%ACu&pageSize=50')).value.items).toHaveLength(50);
    expect((await h.page(s, '?q=%25_&pageSize=50')).value.items).toHaveLength(50);
    const exact = await h.page(s, `?q=${lead.code}`); expect(exact.value.items.map(i => i.id)).toEqual([lead.id]);
    const first = await h.page(s, '?pageSize=50'); expect(first.value.items).toHaveLength(50); expect(first.value.nextCursor).not.toBeNull();
    const second = await h.page(s, `?pageSize=50&cursor=${first.value.nextCursor}`); expect(second.value.items).toHaveLength(50);
    expect(new Set([...first.value.items, ...second.value.items].map(i => i.id)).size).toBe(100);
    expect((await h.page(s, `?pageSize=20&cursor=${first.value.nextCursor}`)).status).toBe(400);
    expect((await h.page(s, `?pageSize=50&status=closed&cursor=${first.value.nextCursor}`)).status).toBe(400);
    const other = await h.source('query-other'); expect((await h.page(other, `?pageSize=50&cursor=${first.value.nextCursor}`)).status).toBe(400);
    await h.db.withLeadTenant(h.clients.get('A1')!.signed.actor, s.tenantId, async tx => {
      const statements = {
        list: sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 51`,
        substring: sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} AND expires_at>clock_timestamp() AND (name ILIKE ${'%minh%'} OR 'YC-'||lpad(code_number::text,greatest(6,length(code_number::text)),'0')='MINH') ORDER BY created_at DESC,id DESC LIMIT 51`,
        count: sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT count(*) FROM (SELECT 1 FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} AND expires_at>clock_timestamp() AND (name ILIKE ${'%minh%'} OR 'YC-'||lpad(code_number::text,greatest(6,length(code_number::text)),'0')='MINH') LIMIT 10001) bounded`,
      };
      for (const [query, statement] of Object.entries(statements)) {
        const rows = await tx.execute(statement), plan = (rows[0]['QUERY PLAN'] as Array<Record<string, unknown>>)[0];
        const root = plan.Plan as Record<string, unknown>; expect(Number(root['Actual Rows'])).toBe(query === 'count' ? 1 : 51);
        console.info(JSON.stringify({ kind: 'S05_QUERY_PLAN', query, role: 'gcms_s02_tenant', forceRls: true, fixtureRows: 10001,
          root: root['Node Type'], executionMs: plan['Execution Time'], sharedHitBlocks: root['Shared Hit Blocks'], plan: root }));
      }
    });
  }, 120000);
  test('recipient defaults preserve the initial admin, tied legacy order needs configuration, and saves are versioned', async () => {
    const s = await h.source('settings'), path = S05_ROUTES.settings(s.tenantId);
    let settings = (await h.call<RecipientSettings>(path)).value; expect(settings.defaultRecipient?.userId).toBe(h.user('A1')); expect(settings.needsConfiguration).toBe(false);
    const c = { operationId: randomUUID(), expectedVersion: settings.version, mode: 'selected', recipientUserIds: [h.user('A2')] };
    expect((await h.call(path, 'PUT', c)).status).toBe(200); expect((await h.call(path, 'PUT', c)).value.replayed).toBe(true);
    expect((await h.call(path, 'PUT', { ...c, operationId: randomUUID() })).value.code).toBe('VERSION_CONFLICT');
    const ambiguous = await h.source('ambiguous', true); settings = (await h.call<RecipientSettings>(S05_ROUTES.settings(ambiguous.tenantId))).value;
    expect(settings.defaultRecipient).toBeNull(); expect(settings.needsConfiguration).toBe(true);
    await h.owned(tx => tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${h.user('A1')}`);
    expect((await h.call(path)).status).toBe(403);
  });
  test('personal assignee cursor binds its resolved administrator, not only the word me', async () => {
    const s = await h.source('personal-cursor'); await h.intake(s); await h.bulk(s, 2);
    const page = await h.page(s);
    for (const lead of page.value.items) expect((await h.command(s, await h.detail(s, lead.id), { kind: 'assign', assigneeUserId: h.user('A1') })).status).toBe(200);
    const first = await h.page(s, '?assignee=me&pageSize=1'); expect(first.value.nextCursor).not.toBeNull();
    const path = `${S05_ROUTES.leads(s.tenantId)}?assignee=me&pageSize=1&cursor=${first.value.nextCursor}`;
    expect((await h.call(path, 'GET', undefined, 'A2')).status).toBe(400);
    expect((await h.call(path)).status).toBe(200);
  });
});
