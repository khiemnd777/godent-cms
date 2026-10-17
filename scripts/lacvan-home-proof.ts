import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { M4_ROUTES, type M4Resolution, type M4Variant } from '../apps/api/src/contracts/m4';
import { privateLacVanText, readLacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';
import { lacVanHash } from './lacvan-catalog';

const PATH = '.local/lacvan-home-proof.json', OWNER = 'GCMS-LACVAN-HOME-PROOF-v1';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
interface Baseline { owner: typeof OWNER; fixtureRun: string; homeId: string; tenantId: string; capturedAt: string; draftVersion: number; viHash: string; enHash: string; viPublicationId: string }
async function main() {
  const [flag, phase] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || process.argv.length !== 4 || flag !== '--local-lacvan' || !['capture', 'draft', 'published'].includes(phase ?? '')) throw new Error('Explicit home proof phase required');
  const f = await readLacVanFixtures();
  const catalog = JSON.parse(await privateLacVanText('.local/lacvan-catalog.json')) as { owner: string; fixtureRun: string; tenantId: string; entries: { key: string; id: string; pins: { en?: { publicationId: string; version: number; publicationVersion: number; contentHash: string } } }[] };
  const homeEntry = catalog.entries.find(e => e.key === 'home'), homeId = homeEntry?.id;
  if (catalog.owner !== 'GCMS-LACVAN-CATALOG-v1' || catalog.fixtureRun !== f.runId || catalog.tenantId !== f.tenant.id || !homeId || !/^[a-f0-9-]{36}$/.test(homeId)) throw new Error('Owned home identity required');
  const http = new LacVanHttp(f.tenant.id, f.tenant.slug, f.identities.find(i => i.label === 'Owner')!); await http.login();
  const draft = await http.get<M4Variant>(M4_ROUTES.resource(f.tenant.id, 'home', homeId, 'vi'));
  const vi = await http.get<M4Resolution>(M4_ROUTES.publicPage(f.tenant.slug, 'vi', 'home', 'home'));
  const en = await http.get<M4Resolution>(M4_ROUTES.publicPage(f.tenant.slug, 'en', 'home', 'home'));
  if (draft.tenantId !== f.tenant.id || vi.resolution !== 'page' || en.resolution !== 'page') throw new Error('Both owned published homes required');
  let result: Record<string, unknown>;
  if (phase === 'capture') {
    if (draft.publishedVersion !== draft.version || draft.publicationId !== vi.page.publicationId) throw new Error('Clean initial publication required');
    const baseline: Baseline = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, homeId, capturedAt: new Date().toISOString(), draftVersion: draft.version, viHash: hash(vi), enHash: hash(en), viPublicationId: vi.page.publicationId };
    await writeFile(PATH, JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    result = { initialPublished: true, languages: ['vi', 'en'], baselineSaved: true };
  } else {
    const baseline = JSON.parse(await privateLacVanText(PATH)) as Baseline;
    if (baseline.owner !== OWNER || baseline.fixtureRun !== f.runId || baseline.tenantId !== f.tenant.id || baseline.homeId !== homeId) throw new Error('Home proof ownership mismatch');
    if (phase === 'draft') {
      if (hash(en) !== baseline.enHash) throw new Error('English response changed while saving Vietnamese draft');
      if (draft.version <= baseline.draftVersion || draft.publishedVersion === draft.version || hash(vi) !== baseline.viHash || vi.page.publicationId !== baseline.viPublicationId) throw new Error('Draft/public snapshot boundary failed');
      result = { savedDraftVersion: draft.version, publicVietnameseUnchanged: true, publicEnglishUnchanged: true };
    } else {
      // The EN response legitimately refreshes its VI alternate's publication ID.
      // Use the immutable EN publication pin recorded before the browser journey.
      const pin = homeEntry?.pins.en, englishDraft = await http.get<M4Variant>(M4_ROUTES.resource(f.tenant.id, 'home', homeId, 'en'));
      if (!pin || en.page.publicationId !== pin.publicationId || en.page.publicationVersion !== pin.publicationVersion || englishDraft.publicationId !== pin.publicationId || englishDraft.version !== pin.version || lacVanHash(englishDraft.content) !== pin.contentHash) throw new Error('English own publication changed during Vietnamese journey');
      if (draft.version <= baseline.draftVersion || draft.publishedVersion !== draft.version || draft.publicationId !== vi.page.publicationId || vi.page.publicationId === baseline.viPublicationId || hash(vi) === baseline.viHash) throw new Error('Explicit publish did not update current snapshot');
      result = { publishedVersion: draft.publishedVersion, newPublicationVisible: true, englishOwnPublicationUnchanged: true, englishEvidence: 'Initial catalog EN publication/version/content pin recorded before CMS editing. EN response alternate metadata follows the new VI head.', englishFullResponseHashChanged: hash(en) !== baseline.enHash };
    }
  }
  const report = { status: 'PASS', phase: `representative-home-${phase}`, recordedAt: new Date().toISOString(), ...result, verification: 'Read-only API observations. CMS interactions and private preview require separate browser evidence.' };
  await writeFile(`docs/evidence/lacvan/home-${phase}-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(report));
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'representative-home-proof', code: error instanceof Error ? error.message : 'Unknown error', credentialsPrinted: false })); process.exitCode = 1; });
