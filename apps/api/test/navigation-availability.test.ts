import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { validateDatabaseUrl } from '../src/auth/policy';

const enabled = process.env.PUBLIC_READ_PERFORMANCE_SQL === '1';
class Rollback extends Error {}
function historical(source: string, name: string) {
  const match = new RegExp(`CREATE(?: OR REPLACE)? FUNCTION gcms_m4\\.${name}\\(`).exec(source);
  if (!match) throw new Error('Missing historical function');
  return source.slice(match.index, source.indexOf('END $$;', match.index) + 7);
}

(enabled ? describe : describe.skip)('navigation reachability preserves publication eligibility', () => {
  let db: SQL;
  beforeAll(() => { db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 }); });
  afterAll(() => db?.close());
  async function rollback(action: (tx: SQL) => Promise<void>) {
    try {
      await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s'");
        if (process.env.NAVIGATION_COMPILE_ONLY === '1') await tx.unsafe(await readFile('apps/api/migrations/0067_navigation_availability.sql', 'utf8'));
        if (process.env.NAVIGATION_REPAIR_COMPILE_ONLY === '1') await tx.unsafe(await readFile('apps/api/migrations/0068_signature_listing_navigation.sql', 'utf8'));
        const target = historical(await readFile('apps/api/migrations/0039_m4_boundary_repairs.sql', 'utf8'), 'target_path').replace('gcms_m4.target_path(', 'pg_temp.original_target_path(');
        const baseNavigation = historical(await readFile('apps/api/migrations/0060_signature_template.sql', 'utf8'), 'signature_navigation');
        // 0064 deliberately makes registered listing routes reachable when empty.
        const repair = await readFile('apps/api/migrations/0064_signature_search_budget.sql', 'utf8');
        const probe = /new_probe text:='((?:''|[^'])*)';BEGIN/.exec(repair)?.[1].replaceAll("''", "'");
        if (!probe) throw new Error('Missing 0064 navigation contract');
        const oldProbe = "EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>'kind') c WHERE gcms_m4.project_core(t,n->>'kind',c.id,n->>'locale',NULL,0,false) IS NOT NULL)";
        if (!baseNavigation.includes(oldProbe)) throw new Error('Unexpected original listing probe');
        const navigation = baseNavigation.replace(oldProbe, probe).replaceAll('gcms_m4.signature_navigation(', 'pg_temp.original_navigation(').replaceAll('gcms_m4.target_path(', 'pg_temp.original_target_path(');
        await tx.unsafe(target); await tx.unsafe(navigation);
        await action(tx as unknown as SQL);
        throw new Rollback();
      });
    } catch (error) { if (!(error instanceof Rollback)) throw error; }
  }
  async function home(tx: SQL) {
    const rows = await tx`SELECT s.tenant_id,d.resource_id FROM gcms_s02.site_draft s JOIN gcms_m4.variant d ON d.tenant_id=s.tenant_id WHERE s.slug='lac-van' AND d.kind='home' AND d.locale='vi'`;
    expect(rows).toHaveLength(1); return { t: rows[0].tenant_id as string, r: rows[0].resource_id as string };
  }
  async function available(tx: SQL, t: string, k: string, r: string, l = 'vi', pub: string | null = null) {
    const result = await tx`SELECT gcms_m4.navigation_available(${t},${k},${r},${l},${pub},0) AS value,gcms_m4.navigation_available(${t},${k},${r},${l},${pub},0)=(gcms_m4.project_core(${t},${k},${r},${l},${pub},0,false) IS NOT NULL) AS equal`;
    expect(result[0].equal).toBe(true); return result[0].value as boolean;
  }

  test('helper is installed and runtime roles cannot call it', () => rollback(async tx => {
    const rows = await tx`SELECT to_regprocedure('gcms_m4.navigation_available(text,text,text,text,text,integer)') IS NOT NULL AS installed`;
    expect(rows[0].installed).toBe(true);
    const permissions = await tx`SELECT has_function_privilege(rolname,'gcms_m4.navigation_available(text,text,text,text,text,integer)','EXECUTE') AS allowed FROM pg_roles WHERE rolname IN ('gcms_s02_tenant','gcms_s02_auth','gcms_s02_platform','gcms_s04_intake')`;
    expect(permissions).toHaveLength(4); for (const permission of permissions) expect(permission.allowed).toBe(false);
  }));

  test('availability equals the unchanged full projection for all clinic variants, both locales and depth limits', () => rollback(async tx => {
    const { t } = await home(tx);
    const rows = await tx`SELECT count(*)::integer AS checked,bool_and(gcms_m4.navigation_available(d.tenant_id,d.kind,d.resource_id,d.locale,p.id,depth)=(gcms_m4.project_core(d.tenant_id,d.kind,d.resource_id,d.locale,p.id,depth,false) IS NOT NULL)) AS equal FROM gcms_m4.variant d LEFT JOIN gcms_m4.publication p ON p.tenant_id=d.tenant_id AND p.id=d.active_publication_id CROSS JOIN unnest(ARRAY[-1,0,1,3,4]) depth WHERE d.tenant_id=${t} AND d.kind<>'config'`;
    expect(rows[0].checked).toBeGreaterThan(500); expect(rows[0].equal).toBe(true);
    const legacy = await tx`SELECT bool_and(gcms_m4.navigation_available(tenant_id,kind,id,'vi',NULL,0)=(gcms_m4.project_core(tenant_id,kind,id,'vi',NULL,0,false) IS NOT NULL)) AS equal FROM (SELECT tenant_id,'service' AS kind,id FROM gcms_s02.service_draft WHERE tenant_id<>${t} ORDER BY id LIMIT 20) legacy`;
    expect(legacy[0].equal).toBe(true);
  }), 90000);

  test('full navigation trees and every resource target match historical output', () => rollback(async tx => {
    const { t } = await home(tx);
    const configs = await tx`SELECT p.content,d.locale FROM gcms_m4.variant d JOIN gcms_m4.publication p ON p.tenant_id=d.tenant_id AND p.id=d.active_publication_id WHERE d.tenant_id=${t} AND d.kind='config'`;
    expect(configs).toHaveLength(2);
    for (const config of configs) {
      const nodes = JSON.stringify(config.content.signature.navigation);
      const result = await tx`SELECT gcms_m4.signature_navigation(${t},${config.locale},${nodes}::text::jsonb,1)=pg_temp.original_navigation(${t},${config.locale},${nodes}::text::jsonb,1) AS equal`;
      expect(result[0].equal).toBe(true);
      const targets = await tx`WITH RECURSIVE nodes(n) AS (SELECT value FROM jsonb_array_elements(${nodes}::text::jsonb) UNION ALL SELECT value FROM nodes CROSS JOIN LATERAL jsonb_array_elements(n->'children')) SELECT bool_and(gcms_m4.target_path(${t},n->'target',(n->>'allowViFallback')::boolean) IS NOT DISTINCT FROM pg_temp.original_target_path(${t},n->'target',(n->>'allowViFallback')::boolean)) AS equal FROM nodes WHERE n->>'type'='resource'`;
      expect(targets[0].equal).toBe(true);
    }
  }), 30000);

  test('empty registered collections stay linked; EN requires a current Published configuration head', () => rollback(async tx => {
    const { t } = await home(tx);
    const nodes = JSON.stringify(['vi', 'en'].map(locale => ({ id: 'dentists-' + locale, label: 'Dentists', type: 'listing', kind: 'doctor', locale, children: [] })));
    const read = async () => (await tx`SELECT gcms_m4.signature_navigation(${t},'vi',${nodes}::text::jsonb,1) AS value,pg_temp.original_navigation(${t},'vi',${nodes}::text::jsonb,1) AS expected,gcms_m4.private_signature_navigation(${t},'vi',${nodes}::text::jsonb,1) AS private`)[0];
    const populated = await read(); expect(populated.value).toHaveLength(2);
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${t} AND kind='doctor'`;
    const empty = await read();
    expect(empty.value).toHaveLength(2);
    expect(empty.value).toEqual(empty.expected);
    expect(empty.value.map((node: { path: string }) => node.path)).toEqual(['/lac-van/bac-si', '/lac-van/en/bac-si']);
    expect(empty.private.map((node: { path: string }) => node.path)).toEqual(['/lac-van/bac-si', '/lac-van/en/bac-si']);
    await tx`SAVEPOINT config_case`;
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${t} AND kind='config' AND locale='en'`;
    const draftOnly = await read(); expect(draftOnly.value).toHaveLength(1); expect(draftOnly.value).toEqual(draftOnly.expected);
    await tx`ROLLBACK TO SAVEPOINT config_case`;
    await tx`UPDATE gcms_m4.variant SET generation=generation+1 WHERE tenant_id=${t} AND kind='config' AND locale='en'`;
    const stale = await read(); expect(stale.value).toHaveLength(1); expect(stale.value).toEqual(stale.expected);
  }), 30000);

  test('required-reference revocation removes the homepage and its navigation link immediately', () => rollback(async tx => {
    const { t, r } = await home(tx); expect(await available(tx, t, 'home', r)).toBe(true);
    const refs = await tx`SELECT ref FROM gcms_m4.variant d JOIN gcms_m4.publication p ON p.tenant_id=d.tenant_id AND p.id=d.active_publication_id CROSS JOIN LATERAL jsonb_array_elements(p.reference_pins) ref WHERE d.tenant_id=${t} AND d.resource_id=${r} AND d.kind='home' AND d.locale='vi' AND ref->'required'='true'::jsonb AND ref->>'kind'='doctor' LIMIT 1`;
    expect(refs).toHaveLength(1); const ref = refs[0].ref;
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${t} AND kind='doctor' AND resource_id=${ref.id} AND locale='vi'`;
    expect(await available(tx, t, 'home', r)).toBe(false);
    const target = JSON.stringify({ kind: 'home', id: r, locale: 'vi' });
    const result = await tx`SELECT gcms_m4.target_path(${t},${target}::text::jsonb,false) AS value,gcms_m4.target_path(${t},${target}::text::jsonb,false) IS NOT DISTINCT FROM pg_temp.original_target_path(${t},${target}::text::jsonb,false) AS equal`;
    expect(result[0].value).toBeNull(); expect(result[0].equal).toBe(true);
  }), 30000);

  test('pinned text permission withdrawal, unpublished locale fallback and tenant isolation remain enforced', () => rollback(async tx => {
    const { t, r } = await home(tx);
    const permissions = await tx`SELECT permission.resource_id,permission.locale,permission.revision,pinned.id AS publication_id FROM gcms_m4.variant d JOIN gcms_m4.publication home ON home.tenant_id=d.tenant_id AND home.id=d.active_publication_id CROSS JOIN LATERAL jsonb_array_elements(home.reference_pins) ref JOIN gcms_m4.publication pinned ON pinned.tenant_id=d.tenant_id AND pinned.id=ref->>'publicationId' JOIN gcms_m4.permission permission ON permission.tenant_id=pinned.tenant_id AND permission.resource_id=pinned.resource_id AND permission.locale=pinned.locale AND permission.kind=pinned.kind AND permission.revision=pinned.draft_version WHERE d.tenant_id=${t} AND d.kind='home' AND d.resource_id=${r} AND d.locale='vi' AND ref->>'kind'='testimonial' AND ref->'required'='true'::jsonb AND permission.scope_key='text' AND permission.withdrawn_at IS NULL LIMIT 1`;
    expect(permissions).toHaveLength(1); const permission = permissions[0];
    expect(await available(tx, t, 'testimonial', permission.resource_id, 'vi', permission.publication_id)).toBe(true);
    await tx`SAVEPOINT permission_case`;
    await tx`UPDATE gcms_m4.permission SET withdrawn_at=clock_timestamp(),withdrawal_reason='Rolled-back homepage performance check' WHERE tenant_id=${t} AND kind='testimonial' AND resource_id=${permission.resource_id} AND locale='vi' AND revision=${permission.revision} AND scope_key='text'`;
    expect(await available(tx, t, 'testimonial', permission.resource_id, 'vi', permission.publication_id)).toBe(false);
    expect(await available(tx, t, 'home', r)).toBe(false);
    await tx`ROLLBACK TO SAVEPOINT permission_case`;
    await tx`UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=${t} AND kind='home' AND resource_id=${r} AND locale='en'`;
    const target = JSON.stringify({ kind: 'home', id: r, locale: 'en' });
    for (const allow of [false, true]) {
      const result = await tx`SELECT gcms_m4.target_path(${t},${target}::text::jsonb,${allow}) AS value,gcms_m4.target_path(${t},${target}::text::jsonb,${allow}) IS NOT DISTINCT FROM pg_temp.original_target_path(${t},${target}::text::jsonb,${allow}) AS equal`;
      expect(result[0].equal).toBe(true);
      if (allow) expect(result[0].value).toMatchObject({ path: '/lac-van', actualLocale: 'vi', fallback: true }); else expect(result[0].value).toBeNull();
    }
    const foreign = await tx`SELECT tenant_id FROM gcms_s02.site_draft WHERE tenant_id<>${t} LIMIT 1`;
    expect(await available(tx, foreign[0].tenant_id, 'home', r)).toBe(false);
    await tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${t}`;
    expect(await available(tx, t, 'home', r)).toBe(false);
  }), 30000);
});
