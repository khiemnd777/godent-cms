import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { privateLacVanText, readLacVanFixtures } from './lacvan-fixtures';

const PATH = '.local/lacvan-compatibility.json', OWNER = 'GCMS-LACVAN-COMPATIBILITY-v1';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
interface Witness { tenantId: string; slug: string; locale: string; theme: string; hashes: Record<string, string> }
async function main() {
  const [flag, mode] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || process.argv.length !== 4 || flag !== '--local-lacvan' || !['capture', 'compare'].includes(mode ?? '')) throw new Error('Explicit retained theme check required');
  const fixture = await readLacVanFixtures();
  const db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    const result = await db.begin(async tx => {
      await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL statement_timeout='15s'; SET TRANSACTION READ ONLY");
      let witnesses: Witness[];
      if (mode === 'capture') {
        const rows = await tx`SELECT tenant_id,slug,locale,theme FROM (SELECT v.tenant_id,d.slug,v.locale,p.content->>'theme' AS theme,row_number() OVER(PARTITION BY p.content->>'theme' ORDER BY v.tenant_id,v.locale) AS n FROM gcms_m4.variant v JOIN gcms_m4.publication p ON p.tenant_id=v.tenant_id AND p.id=v.active_publication_id JOIN gcms_s02.site_draft d ON d.tenant_id=v.tenant_id JOIN gcms_s02.tenant ten ON ten.id=v.tenant_id WHERE v.kind='config' AND v.tenant_id<>${fixture.tenant.id} AND d.public_enabled AND d.slug_locked AND ten.status='active' AND p.content->>'theme' IN ('clarity','showcase')) x WHERE n<=2 ORDER BY theme,tenant_id,locale`;
        witnesses = rows.map((r: { tenant_id: string; slug: string; locale: string; theme: string }) => ({ tenantId: r.tenant_id, slug: r.slug, locale: r.locale, theme: r.theme, hashes: {} }));
      } else {
        const previous = JSON.parse(await privateLacVanText(PATH)) as { owner: string; fixtureRun: string; witnesses: Witness[] };
        if (previous.owner !== OWNER || previous.fixtureRun !== fixture.runId || previous.witnesses.length > 4 || previous.witnesses.some(w => w.tenantId === fixture.tenant.id || !['clarity', 'showcase'].includes(w.theme) || !['vi', 'en'].includes(w.locale))) throw new Error('Wrong retained theme witness ownership');
        witnesses = previous.witnesses;
      }
      if (new Set(witnesses.map(w => w.theme)).size !== 2) throw new Error('Both retained themes need actual witnesses');
      const failures: string[] = [];
      for (const [index, witness] of witnesses.entries()) {
        const cfg = (await tx`SELECT gcms_m4.public_config(${witness.slug},${witness.locale}) AS value`)[0].value;
        if (!cfg || cfg.content?.theme !== witness.theme) throw new Error('Retained public config unavailable');
        const current: Record<string, string> = { config: hash(cfg) };
        for (const family of ['home', 'service', 'doctor', 'article', 'gallery']) {
          const page = (await tx`SELECT gcms_m4.public_list(${witness.slug},${witness.locale},${family},'',NULL,1) AS value`)[0].value;
          current[family] = hash(page);
        }
        if (mode === 'capture') witness.hashes = current;
        else for (const [key, value] of Object.entries(current)) if (witness.hashes[key] !== value) failures.push(`witness-${index}/${key}`);
      }
      return { witnesses, failures };
    });
    if (mode === 'capture') await writeFile(PATH, JSON.stringify({ owner: OWNER, fixtureRun: fixture.runId, witnesses: result.witnesses }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const report = { status: result.failures.length ? 'FAIL' : 'PASS', phase: `retained-theme-${mode}`, recordedAt: new Date().toISOString(), witnesses: result.witnesses.length, themes: [...new Set(result.witnesses.map(w => w.theme))], publicProjectionHashes: result.witnesses.reduce((n, w) => n + Object.keys(w.hashes).length, 0), failures: result.failures, readOnly: true };
    await writeFile(`docs/evidence/lacvan/compatibility-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(report));
    if (result.failures.length) process.exitCode = 1;
  } finally { await db.close(); }
}
if (import.meta.main) void main().catch(async error => {
  await writeFile(`.local/lacvan-compatibility-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error('Retained theme check failed/refused; private diagnostic retained.'); process.exitCode = 1;
});
