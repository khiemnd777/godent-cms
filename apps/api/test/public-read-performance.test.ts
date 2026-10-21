import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { validateDatabaseUrl } from '../src/auth/policy';

const enabled = process.env.PUBLIC_READ_PERFORMANCE_SQL === '1';
class Rollback extends Error {}

function original(source: string, name: string) {
  const start = source.indexOf(`CREATE FUNCTION gcms_m4.${name}(`);
  if (start < 0) throw new Error('Missing historical function');
  return source.slice(start, source.indexOf('END $$;', start) + 7);
}

(enabled ? describe : describe.skip)('public read performance preserves current publication boundaries', () => {
  let db: SQL;
  beforeAll(() => { db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 }); });
  afterAll(() => db?.close());

  async function rollback(action: (tx: SQL) => Promise<void>) {
    try {
      await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='3s'");
        // Temporary historical functions compare behavior on the same statement snapshot.
        const decorate = original(await readFile('apps/api/migrations/0033_m4_public_reads.sql', 'utf8'), 'decorate').replace('gcms_m4.decorate(', 'pg_temp.perf_original_decorate(');
        const listing = original(await readFile('apps/api/migrations/0039_m4_boundary_repairs.sql', 'utf8'), 'public_list').replace('gcms_m4.public_list(', 'pg_temp.perf_original_list(').replaceAll('gcms_m4.decorate(', 'pg_temp.perf_original_decorate(');
        await tx.unsafe(decorate); await tx.unsafe(listing);
        await action(tx as unknown as SQL);
        throw new Rollback();
      });
    } catch (error) { if (!(error instanceof Rollback)) throw error; }
  }

  test('migration is installed and caller-supplied configuration helper is inaccessible to runtime roles', () => rollback(async tx => {
    const rows = await tx`SELECT to_regprocedure('gcms_m4.decorate_with_config(text,text,jsonb,jsonb,jsonb)') IS NOT NULL AS installed`;
    expect(rows[0].installed).toBe(true);
    const permissions = await tx`SELECT rolname,has_function_privilege(rolname,'gcms_m4.decorate_with_config(text,text,jsonb,jsonb,jsonb)','EXECUTE') AS allowed FROM pg_roles WHERE rolname IN ('gcms_s02_tenant','gcms_s02_auth','gcms_s02_platform','gcms_s04_intake')`;
    expect(permissions).toHaveLength(4);
    for (const row of permissions) expect(row.allowed).toBe(false);
  }));

  test('VI/EN list and detail JSON exactly match original projection, including filters and pagination', () => rollback(async tx => {
    for (const locale of ['vi', 'en']) {
      for (const kind of ['home', 'page', 'doctor', 'service', 'location', 'price', 'case', 'gallery', 'testimonial', 'article', 'faq', 'promotion']) {
        const rows = await tx`SELECT gcms_m4.public_list('lac-van',${locale},${kind},'',NULL,21,NULL,NULL,NULL)=pg_temp.perf_original_list('lac-van',${locale},${kind},'',NULL,21,NULL,NULL,NULL) AS equal`;
        expect(rows[0].equal).toBe(true);
      }
      const pages = await tx`SELECT bool_and(gcms_m4.decorate(s.tenant_id,${locale},gcms_m4.project(s.tenant_id,d.kind,d.resource_id,${locale})) IS NOT DISTINCT FROM pg_temp.perf_original_decorate(s.tenant_id,${locale},gcms_m4.project(s.tenant_id,d.kind,d.resource_id,${locale}))) AS equal FROM gcms_s02.site_draft s JOIN gcms_m4.variant d ON d.tenant_id=s.tenant_id WHERE s.slug='lac-van' AND d.locale=${locale} AND d.kind IN ('home','doctor','service','case') AND d.active_publication_id IS NOT NULL`;
      expect(pages[0].equal).toBe(true);
    }
    const comparisons = await tx`SELECT bool_and(gcms_m4.public_list('lac-van','vi','doctor',q,anchor,lim,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van','vi','doctor',q,anchor,lim,NULL,NULL,NULL)) AS equal FROM (VALUES ('',NULL::text,1),('zzz-no-match',NULL::text,21),('',(SELECT min(id) FROM gcms_m3.resource WHERE tenant_id=(SELECT tenant_id FROM gcms_s02.site_draft WHERE slug='lac-van') AND kind='doctor'),2),('',NULL::text,0),('',NULL::text,52)) cases(q,anchor,lim)`;
    expect(comparisons[0].equal).toBe(true);
    const pins = await tx`SELECT ref FROM gcms_m4.publication p JOIN gcms_m4.variant d ON d.tenant_id=p.tenant_id AND d.active_publication_id=p.id CROSS JOIN LATERAL jsonb_array_elements(p.reference_pins) ref WHERE d.tenant_id=(SELECT tenant_id FROM gcms_s02.site_draft WHERE slug='lac-van') AND d.kind='doctor' AND d.locale='vi' LIMIT 1`;
    expect(pins).toHaveLength(1);
    const pin = pins[0].ref;
    const filtered = await tx`SELECT gcms_m4.public_list('lac-van','vi','doctor','',NULL,3,${pin.kind},${pin.id},${pin.publicationId}) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van','vi','doctor','',NULL,3,${pin.kind},${pin.id},${pin.publicationId}) AS equal`;
    expect(filtered[0].equal).toBe(true);
  }), 180000);

  test('statement-local reuse observes unpublish, tenant suspension and withdrawn text permission without stale results', () => rollback(async tx => {
    const rows = await tx`SELECT d.tenant_id,d.resource_id FROM gcms_m4.variant d JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id WHERE s.slug='lac-van' AND d.kind='doctor' AND d.locale='vi' AND d.active_publication_id IS NOT NULL ORDER BY d.resource_id LIMIT 1`;
    const { tenant_id: tenant, resource_id: doctor } = rows[0];
    const read = async () => (await tx`SELECT gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS value`)[0].value;
    expect((await read()).items.some((item: { id: string }) => item.id === doctor)).toBe(true);
    await tx`UPDATE gcms_m4.variant SET content=jsonb_set(content,'{title}','"Unpublished performance check"') WHERE tenant_id=${tenant} AND kind='doctor' AND resource_id=${doctor} AND locale='vi'`;
    expect(JSON.stringify(await read())).not.toContain('Unpublished performance check');
    // All state perturbations are transaction-rolled-back on synthetic fixture content.
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${tenant} AND kind='doctor' AND resource_id=${doctor} AND locale='vi'`;
    expect((await read()).items.some((item: { id: string }) => item.id === doctor)).toBe(false);
    const state = await tx`SELECT gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS equal`;
    expect(state[0].equal).toBe(true);
    const cases = await tx`SELECT p.resource_id,p.locale,p.revision FROM gcms_m4.permission p JOIN gcms_s02.site_draft s ON s.tenant_id=p.tenant_id JOIN gcms_m4.variant d ON d.tenant_id=p.tenant_id AND d.kind=p.kind AND d.resource_id=p.resource_id AND d.locale=p.locale JOIN gcms_m4.publication live ON live.tenant_id=d.tenant_id AND live.id=d.active_publication_id AND live.draft_version=p.revision WHERE s.slug='lac-van' AND p.kind='testimonial' AND p.scope_key='text' AND p.withdrawn_at IS NULL LIMIT 1`;
    expect(cases).toHaveLength(1);
    const permitted = cases[0];
    const visible = await tx`SELECT gcms_m4.public_list('lac-van',${permitted.locale},'testimonial','',NULL,21,NULL,NULL,NULL) AS value`;
    expect(visible[0].value.items.some((item: { id: string }) => item.id === permitted.resource_id)).toBe(true);
    await tx`UPDATE gcms_m4.permission SET withdrawn_at=clock_timestamp(),withdrawal_reason='Rolled-back performance regression check' WHERE tenant_id=${tenant} AND kind='testimonial' AND resource_id=${permitted.resource_id} AND locale=${permitted.locale} AND revision=${permitted.revision} AND scope_key='text'`;
    const revoked = await tx`SELECT gcms_m4.public_list('lac-van',${permitted.locale},'testimonial','',NULL,21,NULL,NULL,NULL) AS value,gcms_m4.public_list('lac-van',${permitted.locale},'testimonial','',NULL,21,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van',${permitted.locale},'testimonial','',NULL,21,NULL,NULL,NULL) AS equal`;
    expect(revoked[0].value.items.some((item: { id: string }) => item.id === permitted.resource_id)).toBe(false);
    expect(revoked[0].equal).toBe(true);
    await tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${tenant}`;
    expect(await read()).toBeNull();
  }), 90000);

  test('public media revocation and foreign-tenant denial remain current after a previously successful read', () => rollback(async tx => {
    const rows = await tx`SELECT s.tenant_id,gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS value FROM gcms_s02.site_draft s WHERE s.slug='lac-van'`;
    const tenant = rows[0].tenant_id, item = rows[0].value.items.find((entry: { media: unknown[] }) => entry.media.length > 0);
    expect(item).toBeDefined();
    const media = item.media[0].media;
    const target = async (t: string) => (await tx`SELECT gcms_m4.media_target(${t},'doctor',${item.id},'vi',${item.publicationId},${media.assetId},${media.revision}) IS NOT NULL AS allowed`)[0].allowed;
    expect(await target(tenant)).toBe(true);
    const other = await tx`SELECT tenant_id FROM gcms_s02.site_draft WHERE tenant_id<>${tenant} LIMIT 1`;
    expect(other).toHaveLength(1);
    expect(await target(other[0].tenant_id)).toBe(false);
    await tx`UPDATE gcms_s07.asset SET state='withdrawn',withdrawn_at=clock_timestamp() WHERE tenant_id=${tenant} AND id=${media.assetId}`;
    expect(await target(tenant)).toBe(false);
    const revoked = await tx`SELECT gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS value,gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS equal`;
    expect(revoked[0].value.items.find((entry: { id: string }) => entry.id === item.id).media).toEqual([]);
    expect(revoked[0].equal).toBe(true);
  }), 30000);

  test('missing locale configuration preserves null handling and original fallback behavior', () => rollback(async tx => {
    const site = await tx`SELECT tenant_id FROM gcms_s02.site_draft WHERE slug='lac-van'`;
    const tenant = site[0].tenant_id;
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${tenant} AND kind='config' AND locale='en'`;
    for (const locale of ['vi', 'en']) {
      const list = await tx`SELECT gcms_m4.public_list('lac-van',${locale},'doctor','',NULL,21,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van',${locale},'doctor','',NULL,21,NULL,NULL,NULL) AS equal`;
      expect(list[0].equal).toBe(true);
    }
    const fallback = await tx`SELECT gcms_m4.read_public('lac-van','en','home','home') AS value`;
    expect(fallback[0].value.resolution).toBe('fallback');
    expect(fallback[0].value.actualLocale).toBe('vi');
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${tenant} AND kind='config' AND locale='vi'`;
    const noConfig = await tx`SELECT gcms_m4.public_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) IS NOT DISTINCT FROM pg_temp.perf_original_list('lac-van','vi','doctor','',NULL,21,NULL,NULL,NULL) AS equal`;
    expect(noConfig[0].equal).toBe(true);
  }), 30000);
});
