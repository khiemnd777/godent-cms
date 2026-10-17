import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { M3_KINDS, M3_ROUTES, type ContentCommandResult, type ContentDraft, type DentalContent } from '../apps/api/src/contracts/m3';
import { M4_ROUTES, type M4CommandResult, type M4Content, type M4Locale, type M4Permission, type M4PermissionScope, type M4Variant, type SitePresentation } from '../apps/api/src/contracts/m4';
import { S03_ROUTES, type PublicationResult, type PublicationService, type ServiceContent, type SiteDraft } from '../apps/api/src/contracts/s03';
import type { LacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';
import { LACVAN_SPECIFICATIONS, lacVanContent, lacVanEntry, lacVanPresentation, type LacVanContentContext, type LacVanContentEntry } from './lacvan-content';

const OWNER = 'GCMS-LACVAN-CATALOG-v1', PATH = '.local/lacvan-catalog.json', LOCK = '.local/lacvan-catalog.lock';
const MEDIA = '.local/lacvan-media.json', ASSETS = 'docs/evidence/lacvan/assets.json';
const locales: M4Locale[] = ['vi', 'en'];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => JSON.stringify(key) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export const lacVanHash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
const same = (a: unknown, b: unknown) => lacVanHash(a) === lacVanHash(b);
class CatalogFailure extends Error { constructor(readonly code: string) { super(code); } }
function requireThat(value: unknown, code: string): asserts value { if (!value) throw new CatalogFailure(code); }
interface Pin { version: number; publicationVersion: number; publicationRevision: number; publicationId: string; contentHash: string; configPublicationId: string | null }
interface Entry extends LacVanContentEntry { phase: 'home' | 'catalog'; legacyCreated: boolean; pins: Partial<Record<M4Locale, Pin>> }
interface Operation { id: string; path: string; method: 'POST' | 'PUT'; body: Record<string, unknown>; intentHash: string; bodyHash: string; receipt: 'command' | 'legacy-service' | 'legacy-publication'; attempted: boolean; completed: boolean; resultHash: string | null }
interface Config { baseline: M4Variant | null; bootstrap: Pin | null; complete: Pin | null; content: SitePresentation | null }
export interface LacVanCatalog {
  owner: typeof OWNER; version: 1; fixtureRun: string; runId: string; tenantId: string; tenantSlug: 'lac-van'; actorId: string;
  generation: number; status: 'planned' | 'home-ready' | 'catalog-ready'; stage: string; createdAt: string; updatedAt: string;
  specificationHash: string; entries: Entry[]; operations: Record<string, Operation>; configs: Record<M4Locale, Config>;
  mediaHash: string; legacyServicePublicationId: string | null; promotionDates: { startAt: string; endAt: string };
  lastError?: { stage: string; code: string; at: string };
}
interface MediaManifest { owner: 'GCMS-LACVAN-MEDIA-v1'; fixtureRun: string; tenantId: string; assets: { key: string; path: string; sha256: string; operationId: string; id: string | null; revision: number | null; processed: boolean }[]; claims: unknown[] }
interface AssetSource { assets: { id: string; path: string; sha256: string; alt: { vi: string; en: string } }[] }
/** Pure ownership and request validation. Nothing here reads credentials or performs HTTP. */
export function validateLacVanCatalog(j: LacVanCatalog, f: Pick<LacVanFixtures, 'owner' | 'runId' | 'status' | 'tenant' | 'identities'>): void {
  const actor = f.identities.find(i => i.label === 'Owner');
  requireThat(f.owner === 'GCMS-LACVAN-001-v1' && f.status === 'complete' && j.owner === OWNER && j.version === 1 && j.fixtureRun === f.runId && uuid(j.runId) && j.tenantId === f.tenant.id && j.tenantSlug === 'lac-van' && f.tenant.slug === j.tenantSlug && j.actorId === actor?.userId, 'CATALOG_OWNERSHIP_MISMATCH');
  requireThat(Number.isSafeInteger(j.generation) && j.generation >= 0 && ['planned', 'home-ready', 'catalog-ready'].includes(j.status) && j.specificationHash === lacVanHash(LACVAN_SPECIFICATIONS) && digest(j.mediaHash), 'INVALID_CATALOG_PLAN');
  requireThat(Array.isArray(j.entries) && j.entries.length === LACVAN_SPECIFICATIONS.length && new Set(j.entries.map(e => e.key)).size === j.entries.length, 'INVALID_CATALOG_ENTRIES');
  const ids = new Set<string>();
  for (const e of j.entries) {
    const s = LACVAN_SPECIFICATIONS.find(s => s.key === e.key);
    requireThat(s && e.kind === s.kind && e.slug === s.slug && e.phase === s.phase && (e.id === null ? e.kind === 'service' && !e.legacyCreated : uuid(e.id) && !ids.has(e.id)) && typeof e.legacyCreated === 'boolean', 'INVALID_CATALOG_ENTRY');
    if (e.id) ids.add(e.id);
    requireThat(e.publicationIds && e.pins && Object.keys(e.publicationIds).every(l => locales.includes(l as M4Locale)) && Object.keys(e.pins).every(l => locales.includes(l as M4Locale)), 'INVALID_ENTRY_LOCALES');
    for (const locale of locales) { const pin = e.pins[locale]; if (pin) { validatePin(pin); requireThat(e.publicationIds[locale] === pin.publicationId, 'ENTRY_PIN_MISMATCH'); } else requireThat(!e.publicationIds[locale], 'ENTRY_PIN_MISSING'); }
  }
  requireThat(j.legacyServicePublicationId === null || uuid(j.legacyServicePublicationId), 'INVALID_LEGACY_PIN');
  requireThat(j.operations && typeof j.operations === 'object' && !Array.isArray(j.operations), 'INVALID_OPERATIONS');
  for (const op of Object.values(j.operations)) {
    const allowed = `/api/tenants/${j.tenantId}/`;
    requireThat(uuid(op.id) && op.path.startsWith(allowed) && !/[\\\s%#]/.test(op.path) && !op.path.split('/').includes('..') && ['POST', 'PUT'].includes(op.method) && digest(op.intentHash) && op.bodyHash === lacVanHash(op.body) && typeof op.completed === 'boolean' && typeof op.attempted === 'boolean', 'INVALID_JOURNAL_COMMAND');
    requireThat(op.receipt === 'legacy-service' ? op.path === S03_ROUTES.services(j.tenantId) && op.method === 'POST' && !('operationId' in op.body) : op.receipt === 'legacy-publication' ? op.body.requestKey === op.id && op.path.endsWith('/publish') : op.receipt === 'command' && op.body.operationId === op.id, 'INVALID_JOURNAL_RECEIPT');
    const targetOwned = op.receipt === 'legacy-service' ? j.entries.some(e => e.kind === 'service' && e.slug === (op.body as { slug?: unknown }).slug) : op.receipt === 'legacy-publication' ? j.entries.some(e => e.kind === 'service' && e.id && op.path === S03_ROUTES.service(j.tenantId, e.id) + '/publish') :
      locales.some(l => op.path === M4_ROUTES.config(j.tenantId, l) && op.method === 'PUT' || op.path === M4_ROUTES.config(j.tenantId, l) + '/publish' && op.method === 'POST') || j.entries.some(e => e.id && (
        locales.some(l => op.path === M4_ROUTES.resources(j.tenantId, e.kind) + '?locale=' + l && op.id === e.id && op.method === 'POST' || op.path === M4_ROUTES.resource(j.tenantId, e.kind, e.id!, l) && op.method === 'PUT' || ['/publish', '/permissions'].some(suffix => op.path === M4_ROUTES.resource(j.tenantId, e.kind, e.id!, l) + suffix && op.method === 'POST')) ||
        (M3_KINDS as readonly string[]).includes(e.kind) && op.path === M3_ROUTES.resources(j.tenantId, e.kind as DentalContent['kind']) && op.id === e.id && op.method === 'POST'));
    requireThat(targetOwned, 'JOURNAL_TARGET_NOT_OWNED');
    requireThat(!op.completed || op.attempted && digest(op.resultHash), 'INVALID_COMMAND_CHECKPOINT');
  }
  requireThat(j.configs && Object.keys(j.configs).sort().join(',') === 'en,vi', 'INVALID_CONFIG_JOURNAL');
  for (const locale of locales) { const c = j.configs[locale]; if (c.baseline) requireThat(c.baseline.id === j.tenantId && c.baseline.tenantId === j.tenantId && c.baseline.kind === 'config' && c.baseline.locale === locale, 'INVALID_CONFIG_BASELINE'); if (c.bootstrap) validatePin(c.bootstrap); if (c.complete) validatePin(c.complete); }
  if (j.status !== 'planned') requireThat(j.entries.filter(e => e.phase === 'home').every(e => e.pins.vi && e.pins.en) && locales.every(l => j.configs[l].complete), 'INCOMPLETE_HOME_CHECKPOINT');
  if (j.status === 'catalog-ready') requireThat(j.entries.every(e => e.pins.vi && e.pins.en), 'INCOMPLETE_CATALOG_CHECKPOINT');
  requireThat(Number.isFinite(Date.parse(j.promotionDates.startAt)) && Number.isFinite(Date.parse(j.promotionDates.endAt)) && j.promotionDates.startAt < j.promotionDates.endAt, 'INVALID_CAMPAIGN_DATES');
}
function validatePin(pin: Pin) { requireThat(Number.isSafeInteger(pin.version) && pin.version > 0 && Number.isSafeInteger(pin.publicationVersion) && pin.publicationVersion > 0 && Number.isSafeInteger(pin.publicationRevision) && pin.publicationRevision > 0 && uuid(pin.publicationId) && digest(pin.contentHash) && (pin.configPublicationId === null || uuid(pin.configPublicationId)), 'INVALID_PUBLICATION_PIN'); }
export function planLacVanCatalog(f: LacVanFixtures, mediaHash: string, now = new Date()): LacVanCatalog {
  const actor = f.identities.find(i => i.label === 'Owner'); requireThat(actor, 'OWNER_IDENTITY_MISSING');
  const journal: LacVanCatalog = { owner: OWNER, version: 1, fixtureRun: f.runId, runId: randomUUID(), tenantId: f.tenant.id, tenantSlug: 'lac-van', actorId: actor.userId, generation: 0, status: 'planned', stage: 'plan-saved', createdAt: now.toISOString(), updatedAt: now.toISOString(), specificationHash: lacVanHash(LACVAN_SPECIFICATIONS), entries: LACVAN_SPECIFICATIONS.map(s => ({ key: s.key, kind: s.kind, slug: s.slug, phase: s.phase, id: s.kind === 'service' ? null : randomUUID(), legacyCreated: false, publicationIds: {}, pins: {} })), operations: {}, configs: { vi: { baseline: null, bootstrap: null, complete: null, content: null }, en: { baseline: null, bootstrap: null, complete: null, content: null } }, mediaHash, legacyServicePublicationId: null, promotionDates: { startAt: new Date(now.getTime() - 86_400_000).toISOString(), endAt: new Date(now.getTime() + 180 * 86_400_000).toISOString() } };
  validateLacVanCatalog(journal, f); return journal;
}
export function lacVanHomeOrder<T extends LacVanContentEntry & { phase: 'home' | 'catalog' }>(entries: T[]): T[] {
  const home = entries.filter(e => e.phase === 'home'), builders = new Set(['home', 'page', 'landing']);
  const contact = home.find(e => e.key === 'page-contact'), page = home.find(e => e.key === 'home'); requireThat(contact && page, 'INCOMPLETE_HOME_PLAN');
  return [...home.filter(e => !builders.has(e.kind)), contact, ...home.filter(e => e.kind === 'page' && e.key !== 'page-contact'), ...home.filter(e => e.kind === 'landing'), page];
}
/** The bounded-v2 plan supersedes only the exact owned, unpublished v1 whose publish was attempted.
 * Existing commands remain unchanged, including the failed publish's request and UUID. */
export function lacVanEntryOperationKeys(j: LacVanCatalog, item: LacVanContentEntry, locale: M4Locale, desired: M4Content, current: M4Variant | null): { save: string; publish: string; repair: boolean } {
  const originalSaveKey = `save-${item.key}-${locale}`, originalPublishKey = `publish-${item.key}-${locale}`, original = j.operations[originalSaveKey];
  if (item.key !== 'home' || !original || same(original.body.content, desired)) return { save: originalSaveKey, publish: originalPublishKey, repair: false };
  const failed = j.operations[originalPublishKey], path = M4_ROUTES.resource(j.tenantId, 'home', item.id!, locale);
  requireThat(j.status === 'planned' && item.kind === 'home' && item.id && current && current.id === item.id && current.tenantId === j.tenantId && current.kind === 'home' && current.locale === locale && !item.publicationIds[locale], 'HOME_REPAIR_IDENTITY_MISMATCH');
  requireThat(original.receipt === 'command' && original.path === M4_ROUTES.resources(j.tenantId, 'home') + '?locale=' + locale && original.method === 'POST' && original.id === item.id && original.body.operationId === original.id && original.completed && original.attempted && original.bodyHash === lacVanHash(original.body) && original.intentHash === lacVanHash(original.body.content), 'HOME_V1_SAVE_CHECKPOINT_CHANGED');
  requireThat(original.resultHash === lacVanHash({ id: item.id, kind: 'home', locale, version: 1, publicationId: null, content: original.body.content }), 'HOME_V1_SAVE_RECEIPT_CHANGED');
  requireThat(failed && failed.receipt === 'command' && failed.path === path + '/publish' && failed.method === 'POST' && failed.attempted && !failed.completed && failed.resultHash === null && failed.bodyHash === lacVanHash(failed.body) && failed.body.operationId === failed.id && failed.body.expectedVersion === 1 && failed.body.expectedPublicationVersion === 0 && failed.body.expectedPublicationRevision === 0 && failed.body.expectedConfigPublicationId === j.configs[locale].bootstrap?.publicationId && failed.intentHash === lacVanHash({ content: original.body.content, id: item.id, locale }), 'HOME_V1_FAILED_PUBLISH_CHANGED');
  const save = `save-home-bounded-v2-${locale}`, publish = `publish-home-bounded-v2-${locale}`, repair = j.operations[save], repairedPublish = j.operations[publish];
  if (repairedPublish) requireThat(repairedPublish.receipt === 'command' && repairedPublish.path === path + '/publish' && repairedPublish.method === 'POST' && repairedPublish.id !== failed.id && repairedPublish.id !== original.id && repairedPublish.body.operationId === repairedPublish.id && repairedPublish.body.expectedVersion === 2 && repairedPublish.body.expectedPublicationVersion === 0 && repairedPublish.body.expectedPublicationRevision === 0 && repairedPublish.body.expectedConfigPublicationId === failed.body.expectedConfigPublicationId && repairedPublish.bodyHash === lacVanHash(repairedPublish.body) && repairedPublish.intentHash === lacVanHash({ content: desired, id: item.id, locale }), 'HOME_V2_PUBLISH_COMMAND_CHANGED');
  if (!repair) {
    requireThat(!repairedPublish && current.version === 1 && current.publicationVersion === 0 && current.publicationRevision === 0 && !current.activePublication && current.publicationId === null && current.publishedVersion === null && same(current.content, original.body.content), 'HOME_V1_PENDING_BASELINE_CHANGED');
  } else {
    requireThat(repair.receipt === 'command' && repair.path === path && repair.method === 'PUT' && repair.id !== original.id && repair.id !== failed.id && repair.body.operationId === repair.id && repair.body.expectedVersion === 1 && same(repair.body.content, desired) && repair.bodyHash === lacVanHash(repair.body) && repair.intentHash === lacVanHash(desired), 'HOME_V2_REPAIR_COMMAND_CHANGED');
    const unchanged = !repair.completed && current.version === 1 && current.publicationVersion === 0 && current.publicationRevision === 0 && !current.activePublication && current.publicationId === null && same(current.content, original.body.content);
    const saved = repair.attempted && current.version === 2 && same(current.content, desired) && (current.publicationVersion === 0 && current.publicationRevision === 0 && !current.activePublication && current.publicationId === null || repairedPublish?.attempted && current.publicationVersion === 1 && current.publicationRevision === 1 && current.activePublication && current.publicationId && current.publishedVersion === 2);
    requireThat(unchanged || saved, 'HOME_V2_CURRENT_STATE_CHANGED');
  }
  return { save, publish, repair: true };
}
async function privateDirectory() { const d = await lstat('.local'); requireThat(d.isDirectory() && !d.isSymbolicLink() && (d.mode & 0o777) === 0o700 && d.uid === process.getuid?.(), 'UNSAFE_PRIVATE_DIRECTORY'); }
async function privateJson<T>(path: string): Promise<T> { await privateDirectory(); const meta = await lstat(path); requireThat(meta.isFile() && !meta.isSymbolicLink() && meta.nlink === 1 && (meta.mode & 0o777) === 0o600 && meta.uid === process.getuid?.() && meta.size <= 4_194_304, 'UNSAFE_PRIVATE_INPUT'); return JSON.parse(await readFile(path, 'utf8')) as T; }
async function acquireLock(f: LacVanFixtures): Promise<() => Promise<void>> {
  const value = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, nonce: randomUUID(), pid: process.pid };
  await privateDirectory();
  try { await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    const old = await privateJson<typeof value>(LOCK); requireThat(old.owner === OWNER && old.fixtureRun === f.runId && old.tenantId === f.tenant.id && uuid(old.nonce) && Number.isSafeInteger(old.pid) && old.pid > 1, 'UNOWNED_CATALOG_LOCK');
    let dead = false; try { process.kill(old.pid, 0); } catch (e) { dead = !!e && typeof e === 'object' && 'code' in e && e.code === 'ESRCH'; }
    requireThat(dead && same(await privateJson(LOCK), old), 'CATALOG_ALREADY_RUNNING'); await unlink(LOCK); await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  }
  return async () => { requireThat(same(await privateJson(LOCK), value), 'CATALOG_LOCK_CHANGED'); await unlink(LOCK); };
}
async function mediaContext(f: LacVanFixtures): Promise<{ hash: string; assets: LacVanContentContext['assets'] }> {
  const media = await privateJson<MediaManifest>(MEDIA), source = JSON.parse(await readFile(ASSETS, 'utf8')) as AssetSource;
  requireThat(media.owner === 'GCMS-LACVAN-MEDIA-v1' && media.fixtureRun === f.runId && media.tenantId === f.tenant.id && Array.isArray(media.assets) && media.assets.length === 24 && source.assets.length === 24 && Array.isArray(media.claims), 'MEDIA_OWNERSHIP_MISMATCH');
  const keys = new Set<string>(), ids = new Set<string>();
  const assets = media.assets.map(a => { const s = source.assets.find(s => s.id === a.key); requireThat(s && !keys.has(a.key) && uuid(a.operationId) && uuid(a.id) && !ids.has(a.id) && a.path === s.path && a.sha256 === s.sha256 && digest(a.sha256) && Number.isSafeInteger(a.revision) && Number(a.revision) > 0 && a.processed && typeof s.alt.vi === 'string' && typeof s.alt.en === 'string', 'MEDIA_NOT_READY_OR_CHANGED'); keys.add(a.key); ids.add(a.id); return { key: a.key, id: a.id, revision: a.revision, processed: a.processed, alt: s.alt }; });
  return { hash: lacVanHash(media.assets), assets };
}
class CatalogRunner {
  constructor(readonly journal: LacVanCatalog, private readonly fixtures: LacVanFixtures, private readonly http: LacVanHttp, private readonly assets: LacVanContentContext['assets']) {}
  private context(): LacVanContentContext { return { entries: this.journal.entries, assets: this.assets, legacyServicePublicationId: this.journal.legacyServicePublicationId, promotionDates: this.journal.promotionDates }; }
  private async store() {
    const previous = await privateJson<LacVanCatalog>(PATH); validateLacVanCatalog(previous, this.fixtures);
    requireThat(previous.runId === this.journal.runId && previous.generation === this.journal.generation, 'CATALOG_CHANGED_CONCURRENTLY');
    this.journal.generation++; this.journal.updatedAt = new Date().toISOString(); validateLacVanCatalog(this.journal, this.fixtures);
    const temp = `.local/lacvan-catalog-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(this.journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, PATH);
  }
  private async operation(key: string, path: string, method: 'POST' | 'PUT', intent: unknown, prepare: () => Record<string, unknown>, id: string = randomUUID()): Promise<M4CommandResult> {
    this.journal.stage = key; let op = this.journal.operations[key];
    if (!op) { const body = { ...prepare(), operationId: id }; op = { id, path, method, body, bodyHash: lacVanHash(body), intentHash: lacVanHash(intent), receipt: 'command', attempted: false, completed: false, resultHash: null }; this.journal.operations[key] = op; await this.store(); }
    requireThat(op.path === path && op.method === method && op.intentHash === lacVanHash(intent) && op.bodyHash === lacVanHash(op.body), 'JOURNAL_PLAN_CHANGED');
    if (!op.attempted) { op.attempted = true; await this.store(); }
    const result = await this.http.command<M4CommandResult>(op.path, op.method, op.body);
    requireThat(result.operationId === op.id && result.draft.tenantId === this.journal.tenantId && uuid(result.draft.id), 'COMMAND_RESPONSE_MISMATCH');
    const resultHash = lacVanHash({ id: result.draft.id, kind: result.draft.kind, locale: result.draft.locale, version: result.draft.version, publicationId: result.draft.publicationId, content: result.draft.content });
    requireThat(!op.completed || op.resultHash === resultHash, 'COMMAND_REPLAY_CHANGED'); op.completed = true; op.resultHash = resultHash; await this.store(); return result;
  }
  private async variant(item: Entry, locale: M4Locale): Promise<M4Variant | null> {
    requireThat(item.id, 'MISSING_RESOURCE_ID'); const response = await this.http.request<M4Variant>(M4_ROUTES.resource(this.journal.tenantId, item.kind, item.id, locale));
    if (response.status === 404) return null;
    requireThat(response.status === 200 && response.value.id === item.id && response.value.tenantId === this.journal.tenantId && response.value.kind === item.kind && response.value.locale === locale, 'VARIANT_IDENTITY_MISMATCH'); return response.value;
  }
  private pin(draft: M4Variant, configPublicationId: string | null): Pin { requireThat(draft.activePublication && draft.publicationId && draft.publishedVersion === draft.version, 'PUBLICATION_NOT_CURRENT'); return { version: draft.version, publicationVersion: draft.publicationVersion, publicationRevision: draft.publicationRevision, publicationId: draft.publicationId, contentHash: lacVanHash(draft.content), configPublicationId }; }
  private matches(draft: M4Variant, pin: Pin) { return draft.activePublication && draft.version === pin.version && draft.publishedVersion === pin.version && draft.publicationVersion === pin.publicationVersion && draft.publicationRevision === pin.publicationRevision && draft.publicationId === pin.publicationId && lacVanHash(draft.content) === pin.contentHash; }
  private async publish(draft: M4Variant, key: string): Promise<{ draft: M4Variant; config: string | null }> {
    const path = draft.kind === 'config' ? M4_ROUTES.config(this.journal.tenantId, draft.locale) : M4_ROUTES.resource(this.journal.tenantId, draft.kind, draft.id, draft.locale);
    const config = draft.kind === 'config' ? null : await this.http.get<M4Variant>(M4_ROUTES.config(this.journal.tenantId, draft.locale));
    if (config) requireThat(config.id === this.journal.tenantId && config.kind === 'config' && config.locale === draft.locale && config.activePublication && config.publicationId, 'CONFIG_NOT_PUBLISHED');
    const existing = this.journal.operations[key];
    const result = await this.operation(key, path + '/publish', 'POST', { content: draft.content, id: draft.id, locale: draft.locale }, () => ({ expectedVersion: draft.version, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedConfigPublicationId: config?.publicationId ?? null }));
    requireThat(result.draft.id === draft.id && result.draft.kind === draft.kind && result.draft.locale === draft.locale && same(result.draft.content, draft.content), 'PUBLISHED_CONTENT_MISMATCH');
    return { draft: result.draft, config: (existing ?? this.journal.operations[key]).body.expectedConfigPublicationId as string | null };
  }
  private async legacyService(item: Entry) {
    if (item.legacyCreated) return;
    const key = `legacy-${item.key}`, desired = lacVanContent(this.context(), item, 'vi', true) as ServiceContent;
    const withoutLinks = { ...desired };
    delete withoutLinks.contentLinks;
    let op = this.journal.operations[key];
    if (!op) { const body = withoutLinks as unknown as Record<string, unknown>; op = { id: randomUUID(), path: S03_ROUTES.services(this.journal.tenantId), method: 'POST', body, bodyHash: lacVanHash(body), intentHash: lacVanHash(body), receipt: 'legacy-service', attempted: false, completed: false, resultHash: null }; this.journal.operations[key] = op; await this.store(); }
    requireThat(op.intentHash === lacVanHash(withoutLinks), 'LEGACY_SERVICE_PLAN_CHANGED');
    let cursor: string | null = null, current: PublicationService | undefined; const seen = new Set<string>();
    do { const page: { items: PublicationService[]; nextCursor: string | null } = await this.http.get(op.path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); const found = page.items.filter(s => s.slug === item.slug); requireThat(found.length <= 1, 'LEGACY_SLUG_COLLISION'); if (found[0]) { current = found[0]; break; } cursor = page.nextCursor; if (cursor) { requireThat(!seen.has(cursor) && seen.size < 100, 'INVALID_SERVICE_CURSOR'); seen.add(cursor); } } while (cursor);
    if (current) requireThat(op.attempted, 'UNOWNED_EXISTING_SERVICE');
    else { requireThat(!op.completed, 'COMPLETED_SERVICE_MISSING'); op.attempted = true; this.journal.stage = key; await this.store(); current = await this.http.command<PublicationService>(op.path, 'POST', op.body); }
    const actual = { slug: current.slug, title: current.title, summary: current.summary, body: current.body, seo: current.seo, coverImage: current.coverImage ?? null };
    requireThat(uuid(current.id) && current.tenantId === this.journal.tenantId && same(actual, withoutLinks) && current.draftVersion === 1 && !current.activePublication, 'LEGACY_SERVICE_OWNERSHIP_MISMATCH');
    item.id = current.id; item.legacyCreated = true; op.completed = true; op.resultHash = lacVanHash(actual); await this.store();
  }
  private async legacyServicePublication() {
    if (this.journal.legacyServicePublicationId) return;
    const item = lacVanEntry(this.context(), 'service-implant'); requireThat(item.id, 'LEGACY_SERVICE_MISSING');
    const key = 'legacy-service-publication', path = S03_ROUTES.service(this.journal.tenantId, item.id) + '/publish'; let op = this.journal.operations[key];
    if (!op) { const draft = await this.http.get<PublicationService>(S03_ROUTES.service(this.journal.tenantId, item.id)), site = await this.http.get<SiteDraft>(S03_ROUTES.site(this.journal.tenantId)); requireThat(!draft.activePublication && draft.publicationVersion === 0 && site.slug === 'lac-van' && site.tenantId === this.journal.tenantId, 'LEGACY_PUBLICATION_STATE_CHANGED'); const id = randomUUID(), body = { requestKey: id, expectedDraftVersion: draft.draftVersion, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedSiteVersion: site.version }; op = { id, path, method: 'POST', body, bodyHash: lacVanHash(body), intentHash: lacVanHash({ id: item.id, slug: item.slug }), receipt: 'legacy-publication', attempted: false, completed: false, resultHash: null }; this.journal.operations[key] = op; await this.store(); }
    requireThat(op.path === path && op.intentHash === lacVanHash({ id: item.id, slug: item.slug }), 'LEGACY_PUBLICATION_PLAN_CHANGED'); op.attempted = true; this.journal.stage = key; await this.store();
    const result = await this.http.command<PublicationResult>(op.path, op.method, op.body); requireThat(result.activePublication && uuid(result.publicationId) && result.publicationVersion === 1 && result.draftVersion === op.body.expectedDraftVersion, 'LEGACY_PUBLICATION_RESPONSE_MISMATCH');
    const resultHash = lacVanHash({ publicationId: result.publicationId, draftVersion: result.draftVersion, publicationVersion: result.publicationVersion }); requireThat(!op.completed || op.resultHash === resultHash, 'LEGACY_PUBLICATION_REPLAY_CHANGED'); this.journal.legacyServicePublicationId = result.publicationId; op.completed = true; op.resultHash = resultHash; await this.store();
  }
  private async legacy(item: Entry) {
    if (item.legacyCreated) return;
    if (item.kind === 'service') return this.legacyService(item);
    if (!(M3_KINDS as readonly string[]).includes(item.kind)) return;
    requireThat(item.id, 'LEGACY_ID_MISSING'); const desired = lacVanContent(this.context(), item, 'vi', true) as DentalContent, key = `legacy-${item.key}`;
    const prior = this.journal.operations[key];
    if (!prior) { const old = await this.http.request<ContentDraft>(M3_ROUTES.resource(this.journal.tenantId, desired.kind, item.id)); requireThat(old.status === 404, 'UNOWNED_EXISTING_LEGACY_CONTENT'); }
    const response = await this.operation(key, M3_ROUTES.resources(this.journal.tenantId, desired.kind), 'POST', desired, () => ({ content: desired }), item.id) as unknown as ContentCommandResult;
    requireThat(response.draft.id === item.id && response.draft.kind === item.kind && same(response.draft.content, desired), 'LEGACY_CONTENT_MISMATCH'); item.legacyCreated = true; await this.store();
  }
  private async permissions(item: Entry, draft: M4Variant) {
    if (!['case', 'gallery', 'testimonial'].includes(item.kind)) return;
    const content = draft.content as DentalContent, scopes: M4PermissionScope[] = [{ type: 'text' }];
    const add = (a: { assetId: string; revision: number } | null) => { if (a && !scopes.some(s => s.type === 'asset' && s.assetId === a.assetId && s.assetRevision === a.revision)) scopes.push({ type: 'asset', assetId: a.assetId, assetRevision: a.revision, usage: 'page' }); };
    if (content.kind === 'gallery') for (const pair of content.pairs) { add(pair.before); add(pair.after); }
    else if (content.kind === 'case' || content.kind === 'testimonial') add(content.image);
    for (const scope of scopes) {
      const key = `permission-${item.key}-${draft.locale}-${scope.type === 'text' ? 'text' : scope.assetId}`, path = M4_ROUTES.resource(this.journal.tenantId, item.kind, item.id!, draft.locale) + '/permissions';
      const evidenceReference = `GCMS-LACVAN-001 original AI-created fictional people/spaces and authored narrative; no real patient or real-patient consent. ${this.journal.runId} ${draft.locale}`;
      const result = await this.operation(key, path, 'POST', { revision: draft.version, scope }, () => ({ expectedVersion: draft.version, revision: draft.version, scope, evidenceReference }));
      const permission = result.permission as M4Permission | undefined; requireThat(permission && permission.resourceId === item.id && permission.kind === item.kind && permission.locale === draft.locale && permission.revision === draft.version && !permission.withdrawnAt && same(permission.scope, scope), 'PERMISSION_RESPONSE_MISMATCH');
    }
  }
  private async ensureEntry(item: Entry) {
    await this.legacy(item);
    for (const locale of locales) {
      const desired = lacVanContent(this.context(), item, locale), oldPin = item.pins[locale]; let current = await this.variant(item, locale);
      if (oldPin) { requireThat(current && this.matches(current, oldPin) && same(current.content, desired), 'OWNED_CONTENT_CHANGED'); continue; }
      const keys = lacVanEntryOperationKeys(this.journal, item, locale, desired, current), key = keys.save, prior = this.journal.operations[key];
      if (!prior && !keys.repair) requireThat(!current || current.virtual, 'UNOWNED_EXISTING_VARIANT');
      let result: M4CommandResult;
      if (prior) result = await this.operation(key, prior.path, prior.method, desired, () => prior.body);
      else if (!current) result = await this.operation(key, M4_ROUTES.resources(this.journal.tenantId, item.kind) + '?locale=' + locale, 'POST', desired, () => ({ content: desired }), item.id!);
      else result = await this.operation(key, M4_ROUTES.resource(this.journal.tenantId, item.kind, item.id!, locale), 'PUT', desired, () => ({ expectedVersion: current!.version, content: desired, ...(current!.legacySource?.current ? { expectedLegacyState: current!.legacySource.current } : {}) }));
      current = result.draft; requireThat(current.id === item.id && current.kind === item.kind && current.locale === locale && same(current.content, desired), 'SAVED_VARIANT_MISMATCH');
      await this.permissions(item, current); const published = await this.publish(current, keys.publish);
      item.pins[locale] = this.pin(published.draft, published.config); item.publicationIds[locale] = published.draft.publicationId!; await this.store();
    }
  }
  private async config(locale: M4Locale, complete: boolean) {
    const record = this.journal.configs[locale], path = M4_ROUTES.config(this.journal.tenantId, locale), current = await this.http.get<M4Variant>(path), desired = lacVanPresentation(this.context(), locale, complete);
    requireThat(current.id === this.journal.tenantId && current.tenantId === this.journal.tenantId && current.kind === 'config' && current.locale === locale, 'CONFIG_IDENTITY_MISMATCH');
    const recorded = complete ? record.complete : record.bootstrap;
    if (recorded) { requireThat(this.matches(current, recorded) && same(current.content, desired), 'OWNED_CONFIG_CHANGED'); return; }
    if (!record.baseline) { requireThat(!current.activePublication && current.publicationId === null && (current.version === 0 || current.virtual), 'PREEXISTING_CONFIG'); record.baseline = current; await this.store(); }
    const key = `config-save-${locale}-${complete ? 'complete' : 'bootstrap'}`, prior = this.journal.operations[key];
    if (!prior) { const baseline = complete ? record.bootstrap : null; requireThat(baseline ? this.matches(current, baseline) : same(current, record.baseline), 'CONFIG_CHANGED_BEFORE_SAVE'); }
    const saved = await this.operation(key, path, 'PUT', desired, () => ({ expectedVersion: current.version, content: desired }));
    const published = await this.publish(saved.draft, `config-publish-${locale}-${complete ? 'complete' : 'bootstrap'}`), pin = this.pin(published.draft, null);
    if (complete) { record.complete = pin; record.content = desired; } else record.bootstrap = pin; await this.store();
  }
  async run(mode: '--home' | '--catalog') {
    await this.http.login();
    if (this.journal.status === 'planned') {
      requireThat(mode === '--home', 'REPRESENTATIVE_HOME_REQUIRED');
      for (const locale of locales) if (!this.journal.configs[locale].bootstrap) await this.config(locale, false);
      // A legacy publication is required only while creating M3 price identities.
      const first = this.journal.entries.find(e => e.key === 'service-implant')!; await this.legacy(first); await this.legacyServicePublication();
      // Freeze every legacy identity before M4 adoption can change its legacy projection.
      for (const item of this.journal.entries.filter(e => e.phase === 'home' && (M3_KINDS as readonly string[]).includes(e.kind))) await this.legacy(item);
      for (const item of lacVanHomeOrder(this.journal.entries)) await this.ensureEntry(item);
      for (const locale of locales) await this.config(locale, true);
      this.journal.status = 'home-ready'; this.journal.stage = 'representative-home-published'; delete this.journal.lastError; await this.store();
    }
    if (mode === '--catalog') {
      // Existing home and config may have genuine CMS edits. Read their identities, never reset them.
      const home = this.journal.entries.find(e => e.key === 'home')!;
      for (const locale of locales) { const current = await this.variant(home, locale); requireThat(current && current.activePublication && current.publicationId, 'REPRESENTATIVE_HOME_UNAVAILABLE'); const config = await this.http.get<M4Variant>(M4_ROUTES.config(this.journal.tenantId, locale)); requireThat(config.id === this.journal.tenantId && config.locale === locale && config.activePublication && config.publicationId, 'CURRENT_CONFIG_UNAVAILABLE'); }
      for (const item of this.journal.entries.filter(e => e.phase === 'catalog')) await this.ensureEntry(item);
      this.journal.status = 'catalog-ready'; this.journal.stage = 'catalog-published-home-preserved'; delete this.journal.lastError; await this.store();
    }
  }
  async recordFailure(error: unknown) { this.journal.lastError = { stage: this.journal.stage, code: error instanceof CatalogFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED', at: new Date().toISOString() }; await this.store(); }
}
async function main() {
  const args = process.argv.slice(2); requireThat(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && args.length === 2 && args[0] === '--local-lacvan' && ['--home', '--catalog'].includes(args[1]), 'EXPLICIT_PINNED_LOCAL_CATALOG_REQUIRED');
  const { readLacVanFixtures } = await import('./lacvan-fixtures');
  const f = await readLacVanFixtures(); requireThat(f.status === 'complete', 'COMPLETE_CLINIC_REQUIRED'); const release = await acquireLock(f);
  let runner: CatalogRunner | undefined;
  try {
    const media = await mediaContext(f); let journal: LacVanCatalog;
    try { journal = await privateJson<LacVanCatalog>(PATH); }
    catch (e) { if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')) throw e; requireThat(args[1] === '--home', 'REPRESENTATIVE_HOME_REQUIRED'); journal = planLacVanCatalog(f, media.hash); await writeFile(PATH, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    validateLacVanCatalog(journal, f); requireThat(journal.mediaHash === media.hash, 'OWNED_MEDIA_CHANGED');
    runner = new CatalogRunner(journal, f, new LacVanHttp(f.tenant.id, f.tenant.slug, f.identities.find(i => i.label === 'Owner')!), media.assets);
    await runner.run(args[1] as '--home' | '--catalog');
    console.info(JSON.stringify({ status: 'PASS', phase: journal.status, tenantSlug: journal.tenantSlug, publishedEntries: journal.entries.filter(e => e.pins.vi && e.pins.en).length, locales, credentialsPrinted: false, existingHomeReset: false }));
  } catch (e) { if (runner) await runner.recordFailure(e); throw e; }
  finally { await release(); }
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'lacvan-catalog', code: error instanceof CatalogFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED', detailsRedacted: true })); process.exitCode = 1; });
