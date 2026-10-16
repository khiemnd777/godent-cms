import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import type { PrivateRequest } from '../apps/api/src/modules/request-security';
import { openFixtureSession, type S02Fixtures } from './s02-fixtures';

export interface S05Fixtures { tenantId: string; tenantSlug: string; serviceId: string; serviceSlug: string; publicationId: string }
async function populateUi(fixture: S05Fixtures) {
  const path = resolve('.local/s05-ui-pagination.json');
  let batch: { tenantId: string; ids: string[]; createdAt: string };
  if (await Bun.file(path).exists()) {
    if (((await stat(path)).mode & 0o777) !== 0o600) throw new Error('Unsafe pagination fixture manifest');
    batch = JSON.parse(await readFile(path, 'utf8'));
  } else {
    batch = { tenantId: fixture.tenantId, ids: Array.from({ length: 55 }, () => randomUUID()), createdAt: new Date().toISOString() };
    await writeFile(path, JSON.stringify(batch, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (batch.tenantId !== fixture.tenantId || batch.ids.length !== 55 || new Set(batch.ids).size !== 55 ||
    batch.ids.some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) || !Number.isFinite(Date.parse(batch.createdAt))) throw new Error('Invalid pagination fixture scope');
  const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try { await client.begin(async tx => {
    await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
    const proof = await tx`SELECT l.id FROM gcms_s02.tenant t JOIN gcms_s02.site_draft s ON s.tenant_id=t.id JOIN gcms_s04.lead l ON l.tenant_id=t.id
      WHERE t.id=${fixture.tenantId} AND t.name='S05 Synthetic UI' AND s.slug=${fixture.tenantSlug} AND l.code_number=1 AND l.source_service_id=${fixture.serviceId} AND l.source_publication_id=${fixture.publicationId}`;
    if (!proof.length) throw new Error('Original S05 browser intake proof required');
    const prior = await tx`SELECT count(*)::integer AS n FROM gcms_s04.lead WHERE tenant_id=${fixture.tenantId} AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(batch.ids)}::text::jsonb))`;
    if (prior[0].n === 55) return;
    if (prior[0].n !== 0) throw new Error('Partial pagination fixture requires inspection');
    await tx`WITH seed AS (SELECT * FROM gcms_s04.lead WHERE tenant_id=${fixture.tenantId} AND code_number=1), ids AS (
      SELECT value AS id,ordinality AS n FROM jsonb_array_elements_text(${JSON.stringify(batch.ids)}::text::jsonb) WITH ORDINALITY), made AS (
      INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,preferred_language,preferred_channel,source_service_id,source_publication_id,
        source_tenant_slug,source_service_slug,source_service_title,source_path,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
      SELECT seed.tenant_id,ids.id,'S05 Minh họa phân trang '||ids.n,'0900999900','vi','phone',seed.source_service_id,seed.source_publication_id,
        seed.source_tenant_slug,seed.source_service_slug,seed.source_service_title,seed.source_path,${batch.createdAt}::timestamptz,seed.consent_version,seed.consent_copy,
        ${batch.createdAt}::timestamptz,${batch.createdAt}::timestamptz,${batch.createdAt}::timestamptz+interval '180 days'
      FROM seed CROSS JOIN ids RETURNING *), intents AS (
      INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) SELECT tenant_id,id,created_at FROM made RETURNING lead_id), requests AS (
      INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at)
      SELECT tenant_id,gen_random_uuid()::text,repeat('0',64),id,source_service_id,source_publication_id,created_at,created_at+interval '24 hours' FROM made RETURNING lead_id)
      INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id,created_at) SELECT gen_random_uuid()::text,tenant_id,'consultation.accepted',id,created_at FROM made`;
  }); } finally { await client.close(); }
  console.info('55 owned synthetic S05 UI pagination leads ready; original browser lead preserved, no public counters or dispatch changed.');
}
/** Creates a dedicated empty UI source. The first public intake belongs to the real browser flow. */
export async function fixturesS05(): Promise<S05Fixtures> {
  if (process.cwd() !== resolve(import.meta.dir, '..') || !process.argv.includes('--local-s05') || !process.argv.includes('--synthetic-fixtures')) throw new Error('Explicit local synthetic S05 scope required');
  const path = resolve('.local/s05-fixtures.json');
  if (await Bun.file(path).exists()) {
    if (((await stat(path)).mode & 0o777) !== 0o600) throw new Error('Unsafe fixture manifest');
    const prior = JSON.parse(await readFile(path, 'utf8')) as S05Fixtures;
    if (!/^[a-f0-9-]{36}$/.test(prior.tenantId) || !prior.tenantSlug.startsWith('s05-ui-')) throw new Error('Unexpected S05 fixture manifest');
    if (process.argv.includes('--populate-ui-leads')) await populateUi(prior);
    if (process.argv.includes('--enable-worker')) {
      const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
      try { await client.begin(async tx => {
        await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
        const proof = await tx`SELECT 1 FROM gcms_s02.tenant t JOIN gcms_s02.site_draft s ON s.tenant_id=t.id
          WHERE t.id=${prior.tenantId} AND t.name='S05 Synthetic UI' AND s.slug=${prior.tenantSlug}`;
        if (!proof.length) throw new Error('Owned S05 fixture proof absent');
        await tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${prior.tenantId},true) ON CONFLICT(tenant_id) DO UPDATE SET enabled=true`;
      }); } finally { await client.close(); }
      console.info('Explicit S05 UI tenant worker scope enabled; no dispatch performed.');
    }
    return prior;
  }
  const prior = JSON.parse(await readFile('.local/s02-fixtures.json', 'utf8')) as S02Fixtures;
  const tenantId = randomUUID(), tenantSlug = `s05-ui-${randomUUID().slice(0, 8)}`, serviceSlug = 'tu-van';
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await owner.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenantId},'S05 Synthetic UI')`;
      for (const [index, label] of ['A1', 'A2'].entries()) {
        const id = prior.identities.find(i => i.label === label)!.userId;
        await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id,created_at) VALUES(${tenantId},${id},clock_timestamp()+${index}*interval '1 millisecond')`;
      }
    });
    const runtime = await loadRuntimeEnvironment(), db = createS02Database({ ...process.env, ...runtime.api }), identity = createS02Auth(db);
    try {
      const signed = await openFixtureSession(identity, 'A1');
      const service = new PublicationServiceOperations(db, identity);
      const request: PrivateRequest = { method: 'PUT', originalUrl: '', headers: { cookie: signed.headers.get('cookie') ?? '', origin: 'http://127.0.0.1:5891',
        'content-type': 'application/json', 'x-csrf-token': identity.csrfToken(signed.actor) } };
      const site = await service.saveSite(request, tenantId, { slug: tenantSlug, name: 'Phòng khám minh họa S05', footer: { intro: 'Nội dung minh họa tổng hợp.', body: legacyDocument('Liên hệ tư vấn') }, expectedVersion: 0 });
      const draft = await service.create({ ...request, method: 'POST' }, tenantId, { slug: serviceSlug, title: 'Tư vấn nha khoa', summary: 'Dịch vụ minh họa cho quy trình tiếp nhận và xử lý tư vấn.',
        body: legacyDocument('Gửi yêu cầu để phòng khám liên hệ tư vấn.'), seo: { title: 'Tư vấn nha khoa', description: 'Dịch vụ minh họa tổng hợp.' } });
      const published = await service.publish({ ...request, method: 'POST' }, tenantId, draft.id, { expectedDraftVersion: draft.draftVersion, expectedPublicationVersion: 0, expectedSiteVersion: site.version, requestKey: randomUUID() });
      const value = { tenantId, tenantSlug, serviceId: draft.id, serviceSlug, publicationId: published.publicationId };
      await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.info('S05 dedicated UI source ready with zero leads; original fixtures unchanged.'); return value;
    } finally { await db.close(); }
  } finally { await owner.close(); }
}
if (import.meta.main) fixturesS05().catch(() => { console.error('S05 fixture setup failed; details redacted, inspect owned rows before retry.'); process.exitCode = 1; });
