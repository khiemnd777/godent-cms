import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { sql } from 'drizzle-orm';
import { legacyDocument } from '../src/contracts/content';
import { S03_ROUTES, type EditorialHistoryPage, type PublicationResult, type PublicationService, type PublicServicePage,
  type RestoreRevisionResult, type ServiceContent, type SiteDraft, type UnpublishServiceInput, type UnpublishServiceResult } from '../src/contracts/s03';
import { S04_ROUTES } from '../src/contracts/s04';
import { postgresCode } from '../src/database';
import { S05Harness, type TestSource } from './s05-support';

const h = new S05Harness(), ownedTenants: string[] = [];
const actor = (label = 'A1') => h.clients.get(label)!.signed.actor;
const servicePath = (s: TestSource) => S03_ROUTES.service(s.tenantId, s.serviceId);
const sitePath = (s: TestSource) => S03_ROUTES.site(s.tenantId);
async function source(label: string) {
  const s = await h.source(`m2-s08-${label}`); ownedTenants.push(s.tenantId);
  console.info(JSON.stringify({ scope: 'S08_NEW_OWNED_FIXTURE', run: h.run, tenantId: s.tenantId }));
  return s;
}
async function draft(s: TestSource) { const r = await h.call<PublicationService>(servicePath(s)); expect(r.status).toBe(200); return r.value; }
async function site(s: TestSource) { const r = await h.call<SiteDraft>(sitePath(s)); expect(r.status).toBe(200); return r.value; }
async function history(s: TestSource, resource: 'service' | 'site' = 'service') {
  const r = await h.call<EditorialHistoryPage>((resource === 'site' ? sitePath(s) : servicePath(s)) + '/history'); expect(r.status).toBe(200); return r.value;
}
function content(d: PublicationService, title = d.title): ServiceContent {
  return { slug: d.slug!, title, summary: d.summary, body: d.body, seo: d.seo, ...(d.coverImage ? { coverImage: d.coverImage } : {}) };
}
async function anonymous<T = PublicServicePage>(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(h.base + path, { method, headers: { host: '127.0.0.1:5890', ...(method === 'GET' ? {} : { origin: 'http://localhost:5892', 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  return { status: r.status, headers: r.headers, value: await r.json() as T };
}
const publicPage = (s: TestSource) => anonymous(S03_ROUTES.publicService(s.tenantSlug, s.serviceSlug));
async function publish(s: TestSource) {
  const d = await draft(s), currentSite = await site(s);
  return h.call<PublicationResult>(servicePath(s) + '/publish', 'POST', { expectedDraftVersion: d.draftVersion, expectedPublicationVersion: d.publicationVersion,
    expectedPublicationRevision: d.publicationRevision, expectedSiteVersion: currentSite.version, requestKey: randomUUID() });
}
async function unpublishInput(s: TestSource): Promise<UnpublishServiceInput> {
  const d = await draft(s); return { operationId: randomUUID(), expectedDraftVersion: d.draftVersion, expectedPublicationVersion: d.publicationVersion, expectedPublicationRevision: d.publicationRevision };
}
async function state(s: TestSource) {
  return h.db.withTenant(actor(), s.tenantId, async tx => (await tx.execute(sql`SELECT
    (SELECT to_jsonb(p) FROM gcms_s02.publication_pointer p WHERE tenant_id=${s.tenantId} AND service_id=${s.serviceId}) AS pointer,
    (SELECT to_jsonb(p) FROM gcms_s08.publication_head p WHERE tenant_id=${s.tenantId} AND service_id=${s.serviceId}) AS head,
    (SELECT count(*)::integer FROM gcms_s08.publication_event WHERE tenant_id=${s.tenantId} AND service_id=${s.serviceId}) AS events,
    (SELECT count(*)::integer FROM gcms_s08.operation_receipt WHERE tenant_id=${s.tenantId}) AS receipts,
    (SELECT count(*)::integer FROM gcms_s02.publication_snapshot WHERE tenant_id=${s.tenantId} AND service_id=${s.serviceId}) AS snapshots`))[0]);
}
async function denied(action: () => Promise<unknown>, code: string) {
  let actual: string | undefined; try { await action(); } catch (error) { actual = postgresCode(error); } expect(actual).toBe(code);
}

describe.skipIf(process.env.S08_INTEGRATION !== '1')('S08 actual API, restricted SQL and immutable editorial lifecycle', () => {
  beforeAll(() => h.setup(), 120000);
  afterAll(async () => { console.info(JSON.stringify({ scope: 'S08_NEW_OWNED_FIXTURES', run: h.run, tenantIds: ownedTenants, cleanupPerformed: false })); await h.close(); });

  test('each save creates one history version, restore creates a new draft, and explicit publish alone changes live', async () => {
    const s = await source('history'), original = await draft(s), first = await publicPage(s), baseline = await history(s);
    expect(baseline.items).toHaveLength(1); expect(baseline.items[0]).toMatchObject({ version: 1, kind: 'created', restoredFrom: null });
    const saved = await h.call<PublicationService>(servicePath(s), 'PUT', { ...content(original, 'S08 Pending V2'), expectedDraftVersion: 1 });
    expect(saved.status).toBe(200); expect(saved.value.draftVersion).toBe(2); expect(saved.value.publishedDraftVersion).toBe(1);
    expect((await history(s)).items.map(r => r.version)).toEqual([2, 1]);
    expect((await publicPage(s)).value).toEqual(first.value);
    const live=await h.call<{page:PublicServicePage;publicationRevision:number}>(servicePath(s)+'/live');
    expect(live.status).toBe(200);expect(live.value.page.publicationId).toBe(s.publicationId);expect(live.value.page.service.title).toBe(original.title);expect(live.value.page.canonicalUrl).toBe(first.value.canonicalUrl);
    const preview = await h.call<{ service: PublicationService }>(servicePath(s) + '/preview'); expect(preview.value.service.title).toBe('S08 Pending V2');
    const operationId = randomUUID(), command = { operationId, expectedVersion: 2, sourceRevisionId: baseline.items[0].id };
    const restored = await h.call<RestoreRevisionResult>(servicePath(s) + '/restore', 'POST', command);
    expect(restored.status).toBe(200); expect(restored.value.service?.draftVersion).toBe(3); expect(restored.value.service?.title).toBe(original.title);
    expect((await publicPage(s)).value).toEqual(first.value);
    const replay = await h.call<RestoreRevisionResult>(servicePath(s) + '/restore', 'POST', command); expect(replay.status).toBe(200); expect(replay.value.replayed).toBe(true); expect(replay.value.appliedVersion).toBe(3);
    const revisions = await history(s); expect(revisions.items).toHaveLength(3); expect(revisions.items[0]).toMatchObject({ version: 3, kind: 'restored', restoredFrom: baseline.items[0].id });
    expect(revisions.items.find(r => r.version === 1)).toEqual(baseline.items[0]);
    expect((await h.call(servicePath(s) + '/restore', 'POST', { ...command, sourceRevisionId: revisions.items[1].id })).status).toBe(409);
    const published = await publish(s); expect(published.status).toBe(200); expect(published.value).toMatchObject({ publicationVersion: 2, publicationRevision: 2, draftVersion: 3, activePublication: true });
    expect((await publicPage(s)).value.publicationId).toBe(published.value.publicationId);
    expect((await publicPage(s)).headers.get('cache-control')).toContain('no-store');
    const old = await h.owned(tx => tx`SELECT closure FROM gcms_s02.publication_snapshot WHERE tenant_id=${s.tenantId} AND id=${s.publicationId}`);
    expect(old[0].closure.service.title).toBe(first.value.service.title);
  });

  test('another current administrator publishes without rewriting already locked site routing metadata',async()=>{
    const s=await source('different-publisher'),d=await draft(s),currentSite=await site(s),before=await history(s,'site');
    const saved=await h.call<PublicationService>(servicePath(s),'PUT',{...content(d,'A2 current content'),expectedDraftVersion:d.draftVersion},'A2');expect(saved.status).toBe(200);
    const published=await h.call<PublicationResult>(servicePath(s)+'/publish','POST',{expectedDraftVersion:saved.value.draftVersion,expectedSiteVersion:currentSite.version,expectedPublicationVersion:saved.value.publicationVersion,expectedPublicationRevision:saved.value.publicationRevision,requestKey:randomUUID()},'A2');
    expect(published.status).toBe(200);expect(published.value.activePublication).toBe(true);expect((await publicPage(s)).value.service.title).toBe('A2 current content');
    expect(await site(s)).toEqual(currentSite);expect(await history(s,'site')).toEqual(before);
    const snapshot=await h.owned(tx=>tx`SELECT published_by FROM gcms_s02.publication_snapshot WHERE tenant_id=${s.tenantId} AND id=${published.value.publicationId}`);expect(snapshot[0].published_by).toBe(actor('A2').userId);
  });

  test('unpublish denies new intake, preserves accepted retry and source snapshot, and old publish receipts do not regrant access', async () => {
    const s = await source('unpublish'), lead = await h.intake(s), command = await unpublishInput(s);
    const oldSnapshot = await h.owned(tx => tx`SELECT request_key,closure FROM gcms_s02.publication_snapshot WHERE tenant_id=${s.tenantId} AND id=${s.publicationId}`);
    const accepted = await h.owned(tx => tx`SELECT request_key FROM gcms_s04.accepted_request WHERE tenant_id=${s.tenantId} AND lead_id=${lead.id}`);
    const removed = await h.call<UnpublishServiceResult>(servicePath(s) + '/unpublish', 'POST', command);
    expect(removed.status).toBe(200); expect(removed.value.service).toMatchObject({ activePublication: false, publicationVersion: 1, publicationRevision: 2 });
    expect((await publicPage(s)).status).toBe(404);
    expect((await h.call<{ page: unknown }>(servicePath(s) + '/live')).value.page).toBeNull();
    const payload = { requestKey: String(accepted[0].request_key), sourcePublicationId: s.publicationId, name: 'Synthetic Minh', phone: '0900123456', preferredChannel: 'phone', preferredLanguage: 'vi', consent: true };
    const newIntake = await anonymous<{ code: string }>(S04_ROUTES.intake(s.tenantSlug, s.serviceSlug), 'POST', { ...payload, requestKey: randomUUID() });
    expect(newIntake.status).toBe(404); expect(newIntake.value.code).toBe('SOURCE_UNAVAILABLE');
    const replay = await anonymous<{ status: string }>(S04_ROUTES.intake(s.tenantSlug, s.serviceSlug), 'POST', payload); expect(replay.status).toBe(200); expect(replay.value).toEqual({ status: 'accepted' });
    const originalPublish = await h.call<PublicationResult>(servicePath(s) + '/publish', 'POST', { expectedDraftVersion: 1, expectedPublicationVersion: 0, expectedSiteVersion: 1, requestKey: String(oldSnapshot[0].request_key) });
    expect(originalPublish.status).toBe(200); expect(originalPublish.value.replayed).toBe(true); expect(originalPublish.value.activePublication).toBe(false); expect((await publicPage(s)).status).toBe(404);
    const next = await publish(s); expect(next.status).toBe(200); expect(next.value).toMatchObject({ publicationVersion: 2, publicationRevision: 3, activePublication: true });
    const oldUnpublish = await h.call<UnpublishServiceResult>(servicePath(s) + '/unpublish', 'POST', command); expect(oldUnpublish.status).toBe(200); expect(oldUnpublish.value.replayed).toBe(true); expect(oldUnpublish.value.service.activePublication).toBe(true);
    expect((await publicPage(s)).value.publicationId).toBe(next.value.publicationId);
    const kept = await h.owned(tx => tx`SELECT source_publication_id FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} AND id=${lead.id}`); expect(kept[0].source_publication_id).toBe(s.publicationId);
    expect((await h.owned(tx => tx`SELECT closure FROM gcms_s02.publication_snapshot WHERE tenant_id=${s.tenantId} AND id=${s.publicationId}`))[0].closure).toEqual(oldSnapshot[0].closure);
  });

  test('two administrators using the same expected version cannot overwrite save, restore or unpublish', async () => {
    const s = await source('races'), original = await draft(s), initial = (await history(s)).items[0];
    const saves = await Promise.all(['A1', 'A2'].map(label => h.call(servicePath(s), 'PUT', { ...content(original, `Concurrent ${label}`), expectedDraftVersion: 1 }, label)));
    expect(saves.map(r => r.status).sort()).toEqual([200, 409]); expect((await draft(s)).draftVersion).toBe(2);
    const restores = await Promise.all(['A1', 'A2'].map(label => h.call(servicePath(s) + '/restore', 'POST', { operationId: randomUUID(), expectedVersion: 2, sourceRevisionId: initial.id }, label)));
    expect(restores.map(r => r.status).sort()).toEqual([200, 409]); expect((await draft(s)).draftVersion).toBe(3); expect((await history(s)).items).toHaveLength(3);
    const current = await unpublishInput(s), removals = await Promise.all(['A1', 'A2'].map(label => h.call(servicePath(s) + '/unpublish', 'POST', { ...current, operationId: randomUUID() }, label)));
    expect(removals.map(r => r.status).sort()).toEqual([200, 409]); expect((await draft(s)).publicationRevision).toBe(2);
    expect((await state(s)).events).toBe(2);
  });

  test('precommit unpublish failure rolls pointer, head, event and receipt back together', async () => {
    const s = await source('rollback'), command = await unpublishInput(s), before = await state(s), beforePublic = await publicPage(s);
    let faultObserved = false;
    try {
      await h.db.withTenant(actor(), s.tenantId, async tx => {
        const result = (await tx.execute(sql`SELECT gcms_s08.unpublish(${s.tenantId},${s.serviceId},${JSON.stringify(command)}::text::jsonb) AS value`))[0].value as { replayed: boolean };
        expect(result.replayed).toBe(false); throw new Error('Owned S08 precommit fault');
      });
    } catch (error) { faultObserved = error instanceof Error && error.message === 'Owned S08 precommit fault'; }
    expect(faultObserved).toBe(true); expect(await state(s)).toEqual(before); expect((await publicPage(s)).value).toEqual(beforePublic.value);
    const snapshot = randomUUID(); let publishFault = false;
    try {
      await h.db.withTenant(actor(), s.tenantId, async tx => {
        await tx.execute(sql`INSERT INTO gcms_s02.publication_snapshot(tenant_id,service_id,id,publication_version,draft_version,site_version,request_key,request_fingerprint,closure,published_by)
          SELECT d.tenant_id,d.id,${snapshot},2,d.version,site.version,${randomUUID()},${'0'.repeat(64)},gcms_s02.snapshot_closure(d,site),${actor().userId}
          FROM gcms_s02.service_draft d JOIN gcms_s02.site_draft site ON site.tenant_id=d.tenant_id WHERE d.tenant_id=${s.tenantId} AND d.id=${s.serviceId}`);
        await tx.execute(sql`INSERT INTO gcms_s02.publication_pointer(tenant_id,service_id,snapshot_id) VALUES(${s.tenantId},${s.serviceId},${snapshot}) ON CONFLICT(tenant_id,service_id) DO UPDATE SET snapshot_id=excluded.snapshot_id`);
        await tx.execute(sql`INSERT INTO gcms_s02.publication_intent(tenant_id,service_id,snapshot_id) VALUES(${s.tenantId},${s.serviceId},${snapshot})`);
        throw new Error('Owned S08 publication precommit fault');
      });
    } catch (error) { publishFault = error instanceof Error && error.message === 'Owned S08 publication precommit fault'; }
    expect(publishFault).toBe(true); expect(await state(s)).toEqual(before); expect((await publicPage(s)).value).toEqual(beforePublic.value);
    expect((await h.call(servicePath(s) + '/unpublish', 'POST', command)).status).toBe(200);
    expect((await state(s)).events).toBe(2); expect((await state(s)).receipts).toBe(1);
  });

  test('actual response loss after commit replays one durable unpublish operation', async () => {
    const s = await source('response-loss'), command = await unpublishInput(s), c = h.clients.get('A1')!;
    let release!: () => void, committed!: () => void, upstreamStatus = 0;
    const gate = new Promise<void>(resolve => { release = resolve; }), barrier = new Promise<void>(resolve => { committed = resolve; });
    const proxy = createServer(async (request, response) => {
      request.resume(); const upstream = await fetch(h.base + servicePath(s) + '/unpublish', { method: 'POST', headers: { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891',
        cookie: c.signed.headers.get('cookie') ?? '', 'content-type': 'application/json', 'x-csrf-token': c.csrf }, body: JSON.stringify(command), signal: AbortSignal.timeout(12000) });
      upstreamStatus = upstream.status; await upstream.arrayBuffer(); committed(); await gate; response.destroy();
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('Owned proxy address unavailable');
      const controller = new AbortController(), pending = fetch(`http://127.0.0.1:${address.port}`, { method: 'POST', body: JSON.stringify(command), signal: controller.signal }).then(r => r.arrayBuffer());
      await barrier; controller.abort(); let lost = false; try { await pending; } catch { lost = true; }
      expect(lost).toBe(true); expect(upstreamStatus).toBe(200);
    } finally { release(); proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
    const replay = await h.call<UnpublishServiceResult>(servicePath(s) + '/unpublish', 'POST', command);
    expect(replay.status).toBe(200); expect(replay.value.replayed).toBe(true); expect(replay.value.service.publicationRevision).toBe(2);
    const current = await state(s); expect(current.events).toBe(2); expect(current.receipts).toBe(1); expect(current.pointer).toBeNull();
  });

  test('private history/restore/unpublish retain tenant, platform, CSRF and password reauthentication boundaries', async () => {
    const s = await source('permission'), initial = (await history(s)).items[0], command = await unpublishInput(s);
    expect((await anonymous(servicePath(s) + '/history')).status).toBe(401);
    for (const label of ['B1', 'PlatformOnly']) {
      expect((await h.call(servicePath(s) + '/history', 'GET', undefined, label)).status).toBe(403);
      expect((await h.call(sitePath(s) + '/history', 'GET', undefined, label)).status).toBe(403);
      expect((await h.call(servicePath(s) + '/restore', 'POST', { operationId: randomUUID(), expectedVersion: 1, sourceRevisionId: initial.id }, label)).status).toBe(403);
      expect((await h.call(servicePath(s) + '/unpublish', 'POST', command, label)).status).toBe(403);
    }
    expect((await h.call(servicePath(s) + '/unpublish', 'POST', command, 'A1', { 'x-csrf-token': 'wrong' })).status).toBe(403);
    const client = h.clients.get('A1')!, session = client.signed.actor.sessionId;
    const original = await h.owned(tx => tx`SELECT created_at FROM gcms_s02_auth.session WHERE id=${session}`);
    try {
      await h.owned(async tx => { await tx`UPDATE gcms_s02_auth.session SET created_at=clock_timestamp()-interval '6 minutes' WHERE id=${session}`; await tx`DELETE FROM gcms_s02_auth.reauth_grant WHERE session_id=${session}`; });
      const denied = await h.call<{ code: string }>(servicePath(s) + '/unpublish', 'POST', command); expect(denied.status).toBe(403); expect(denied.value.code).toBe('REAUTH_REQUIRED');
      expect((await h.call('/api/session/reauth', 'POST', { password: client.signed.fixture.password })).status).toBe(200);
      expect((await h.call(servicePath(s) + '/unpublish', 'POST', command)).status).toBe(200);
    } finally { await h.owned(tx => tx`UPDATE gcms_s02_auth.session SET created_at=${original[0].created_at} WHERE id=${session}`); }
    expect((await h.db.tenantDb.execute(sql`SELECT id FROM gcms_s08.editorial_revision`))).toHaveLength(0);
    await denied(() => Promise.resolve(h.db.platformDb.execute(sql`SELECT id FROM gcms_s08.editorial_revision`)), '42501');
  });

  test('direct tenant SQL rejects null, missing, string, fractional and overflowing unpublish versions without effects', async () => {
    const s = await source('sql-shape'), command = await unpublishInput(s), before = await state(s);
    const cases: unknown[] = [null, [], {}, { ...command, operationId: null }];
    for (const field of ['expectedDraftVersion', 'expectedPublicationVersion', 'expectedPublicationRevision']) {
      for (const value of [null, '1', 0, -1, 1.2, 2147483648, 1e30]) cases.push({ ...command, [field]: value });
      const missing = { ...command } as Record<string, unknown>; delete missing[field]; cases.push(missing);
    }
    for (const input of cases) {
      const result = await h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`SELECT gcms_s08.unpublish(${s.tenantId},${s.serviceId},${JSON.stringify(input)}::text::jsonb) AS value`));
      expect(result[0].value).toEqual({ code: 'INVALID_INPUT' }); expect(await state(s)).toEqual(before);
    }
    const sqlNull = await h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`SELECT gcms_s08.unpublish(${s.tenantId},${s.serviceId},NULL::jsonb) AS value`));
    expect(sqlNull[0].value).toEqual({ code: 'INVALID_INPUT' }); expect(await state(s)).toEqual(before);
  });

  test('history and events are immutable; content requires the next version while slug-lock metadata does not', async () => {
    const s = await source('history-guard'), before = await history(s);
    await denied(() => h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`UPDATE gcms_s02.service_draft SET title='Unversioned edit' WHERE tenant_id=${s.tenantId} AND id=${s.serviceId}`)), '23514');
    await denied(() => h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`UPDATE gcms_s02.site_draft SET name='Unversioned site' WHERE tenant_id=${s.tenantId}`)), '23514');
    await denied(() => h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`UPDATE gcms_s02.service_draft SET version=version+2,title='Skipped version' WHERE tenant_id=${s.tenantId} AND id=${s.serviceId}`)), '23514');
    await denied(() => h.owned(tx => tx`UPDATE gcms_s08.editorial_revision SET kind='saved' WHERE tenant_id=${s.tenantId}`), '23514');
    await denied(() => h.owned(tx => tx`DELETE FROM gcms_s08.publication_event WHERE tenant_id=${s.tenantId}`), '23514');
    const created = await h.call<PublicationService>(S03_ROUTES.services(s.tenantId), 'POST', { ...content(await draft(s), 'Metadata-only draft'), slug: 'metadata-only' }); expect(created.status).toBe(201); expect(created.value.slugLocked).toBe(false);
    await h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`UPDATE gcms_s02.service_draft SET slug_locked=true WHERE tenant_id=${s.tenantId} AND id=${created.value.id}`));
    const metadata = await h.call<PublicationService>(S03_ROUTES.service(s.tenantId, created.value.id)); expect(metadata.value.slugLocked).toBe(true); expect(metadata.value.draftVersion).toBe(1);
    expect((await h.call<EditorialHistoryPage>(S03_ROUTES.service(s.tenantId, created.value.id) + '/history')).value.items).toHaveLength(1);
    expect((await history(s)).items).toEqual(before.items);
  });

  test('site restore restores content only and keeps current routing, slug lock and public eligibility', async () => {
    const s = await source('site-restore'), first = await site(s), firstHistory = await history(s, 'site'), live = await publicPage(s);
    const saved = await h.call<SiteDraft>(sitePath(s), 'PUT', { slug: first.slug, name: 'Pending site name', footer: { intro: 'Pending intro', body: legacyDocument('Pending footer') }, expectedVersion: 1 });
    expect(saved.status).toBe(200); expect(saved.value.version).toBe(2); expect((await publicPage(s)).value.site).toEqual(live.value.site);
    await h.owned(tx => tx`UPDATE gcms_s02.site_draft SET public_enabled=false WHERE tenant_id=${s.tenantId}`);
    const command = { operationId: randomUUID(), expectedVersion: 2, sourceRevisionId: firstHistory.items[0].id };
    const restored = await h.call<RestoreRevisionResult>(sitePath(s) + '/restore', 'POST', command);
    expect(restored.status).toBe(200); expect(restored.value.site).toMatchObject({ version: 3, name: first.name, slug: first.slug, slugLocked: true });
    const historyNow = await history(s, 'site'); expect(historyNow.items).toHaveLength(3); expect(historyNow.items[0]).toMatchObject({ kind: 'restored', restoredFrom: firstHistory.items[0].id });
    const eligibility = await h.owned(tx => tx`SELECT public_enabled,slug,slug_locked FROM gcms_s02.site_draft WHERE tenant_id=${s.tenantId}`);
    expect(eligibility[0]).toMatchObject({ public_enabled: false, slug: s.tenantSlug, slug_locked: true });
    expect((await publicPage(s)).status).toBe(404);
    expect((await h.call<RestoreRevisionResult>(sitePath(s) + '/restore', 'POST', command)).value.replayed).toBe(true);
  });

  test('a historical snapshot cannot recreate a pointer in a later transaction', async () => {
    const s = await source('pointer-replay'), command = await unpublishInput(s);
    expect((await h.call(servicePath(s) + '/unpublish', 'POST', command)).status).toBe(200); const before = await state(s);
    await denied(() => h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`INSERT INTO gcms_s02.publication_pointer(tenant_id,service_id,snapshot_id) VALUES(${s.tenantId},${s.serviceId},${s.publicationId})`)), '23514');
    expect(await state(s)).toEqual(before); expect((await publicPage(s)).status).toBe(404);
    const next = await publish(s); expect(next.status).toBe(200);
    const after = await state(s);
    await denied(() => h.db.withTenant(actor(), s.tenantId, tx => tx.execute(sql`UPDATE gcms_s02.publication_pointer SET snapshot_id=${s.publicationId} WHERE tenant_id=${s.tenantId} AND service_id=${s.serviceId}`)), '23514');
    expect(await state(s)).toEqual(after); expect((await publicPage(s)).value.publicationId).toBe(next.value.publicationId);
  });
  test('history pagination is stable and its cursor is bound to the resource', async () => {
    const s = await source('pagination'); let current = await draft(s);
    for (let n = 2; n <= 28; n++) {
      const saved = await h.call<PublicationService>(servicePath(s), 'PUT', { ...content(current, `Synthetic version ${n}`), expectedDraftVersion: current.draftVersion });
      expect(saved.status).toBe(200); current = saved.value;
    }
    const first = await history(s); expect(first.items).toHaveLength(25); expect(first.items.map(item => item.version)).toEqual(Array.from({ length: 25 }, (_, n) => 28 - n)); expect(first.nextCursor).not.toBeNull();
    const next = await h.call<EditorialHistoryPage>(servicePath(s) + '/history?cursor=' + encodeURIComponent(first.nextCursor!));
    expect(next.status).toBe(200); expect(next.value.items.map(item => item.version)).toEqual([3, 2, 1]); expect(next.value.nextCursor).toBeNull();
    expect(new Set([...first.items, ...next.value.items].map(item => item.id)).size).toBe(28);
    expect((await h.call(sitePath(s) + '/history?cursor=' + encodeURIComponent(first.nextCursor!))).status).toBe(400);
  }, 30000);
});
