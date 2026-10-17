import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { M4_ROUTES, type M4Locale, type M4Resolution } from '../apps/api/src/contracts/m4';
import { readLacVanFixtures, privateLacVanText } from './lacvan-fixtures';
import { validateLacVanCatalog, type LacVanCatalog } from './lacvan-catalog';
import { LacVanHttp } from './lacvan-http';

async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || process.argv.slice(2).join(' ') !== '--local-lacvan') throw new Error('Explicit owned catalog proof required');
  const fixtures = await readLacVanFixtures(), catalog = JSON.parse(await privateLacVanText('.local/lacvan-catalog.json')) as LacVanCatalog;
  validateLacVanCatalog(catalog, fixtures);
  if (catalog.status !== 'catalog-ready') throw new Error('Complete catalog required');
  const http = new LacVanHttp(fixtures.tenant.id, fixtures.tenant.slug, fixtures.identities.find(i => i.label === 'Owner')!);
  const results: { key: string; kind: string; locale: string; status: number; eligible: boolean; publicationId: string | null }[] = [];
  // Two bounded readers inspect all selected resources. This helper performs no content commands.
  const tasks = catalog.entries.flatMap(entry => (['vi', 'en'] as M4Locale[]).map(locale => ({ entry, locale })));
  let index = 0;
  async function reader() {
    while (index < tasks.length) {
      const { entry, locale } = tasks[index++];
      const r = await http.request<M4Resolution>(M4_ROUTES.publicPage(fixtures.tenant.slug, locale, entry.kind, entry.slug));
      const page = r.value?.resolution === 'page' ? r.value.page : null;
      const eligible = r.status === 200 && page?.id === entry.id && page.kind === entry.kind && page.actualLocale === locale && page.config?.content.theme === 'signature' && (page.config?.signature?.navigation.length ?? 0) > 0;
      results.push({ key: entry.key, kind: entry.kind, locale, status: r.status, eligible: !!eligible, publicationId: page?.publicationId ?? null });
    }
  }
  await Promise.all([reader(), reader()]);
  results.sort((a, b) => a.key.localeCompare(b.key) || a.locale.localeCompare(b.locale));
  const report = { task: 'GCMS-LACVAN-001', status: results.every(r => r.eligible) && results.length === 142 ? 'PASS' : 'FAIL', mode: 'read-only-public-API', resources: catalog.entries.length, variants: results.length, families: [...new Set(results.map(r => r.kind))].sort(), results, recordedAt: new Date().toISOString(), limits: ['API eligibility and identity checks do not replace rendered family checks.', 'No content commands, worker dispatch or old fixture changes occur.'] };
  const evidence = `docs/evidence/lacvan/catalog-proof-${Date.now()}.json`;
  await writeFile(evidence, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.info(JSON.stringify({ status: report.status, resources: report.resources, variants: report.variants, evidence, failures: results.filter(r => !r.eligible).map(r => ({ key: r.key, locale: r.locale, status: r.status })) }));
  if (report.status !== 'PASS') process.exitCode = 1;
}
if (import.meta.main) void main().catch(() => { console.error('Owned catalog proof failed; no content commands were executed.'); process.exitCode = 1; });
