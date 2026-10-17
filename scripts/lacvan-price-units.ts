import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DentalContent } from '../apps/api/src/contracts/m3';
import { M4_ROUTES, type BuilderContent, type M4CommandResult, type M4Content, type M4Locale, type M4Resolution, type M4Variant, type ReferenceSection } from '../apps/api/src/contracts/m4';
import { parseM4Content } from '../apps/api/src/contracts/m4-validation';
import { lacVanHash as hash, validateLacVanCatalog, type LacVanCatalog } from './lacvan-catalog';
import { LACVAN_PRICE_UNITS, lacVanPriceUnit } from './lacvan-content';
import type { LacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';
import { expectedPublicQuoteContent } from './lacvan-quotes-proof';

const OWNER = 'GCMS-LACVAN-PRICE-UNITS-v1', PATH = '.local/lacvan-price-units.json', LOCK = '.local/lacvan-price-units.lock', CATALOG = '.local/lacvan-catalog.json';
const locales: M4Locale[] = ['vi', 'en'], services = Object.keys(LACVAN_PRICE_UNITS);
export const CHANGED_PRICE_UNIT_SERVICES = ['implant', 'orthodontics', 'restorative', 'wisdom'] as const;
const changed = (service: string) => (CHANGED_PRICE_UNIT_SERVICES as readonly string[]).includes(service);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const rawHash = (s: string) => createHash('sha256').update(s).digest('hex');
const equal = (a: unknown, b: unknown) => hash(a) === hash(b);
class UnitsFailure extends Error { constructor(readonly code: string) { super(code); } }
function assert(value: unknown, code: string): asserts value { if (!value) throw new UnitsFailure(code); }
type Price = Extract<DentalContent, { kind: 'price' }>;
type Step = 'save' | 'publish';
interface Request { path: string; method: 'POST' | 'PUT'; body: Record<string, unknown> }
export interface PriceUnitOperation { id: string; request: Request | null; requestHash: string | null; attempted: boolean; reply: M4CommandResult | null; replyHash: string | null }
interface Target { key: string; catalogKey: string; service: string | null; kind: 'price' | 'page'; changed: boolean; id: string; slug: string; locale: M4Locale; before: M4Variant | null; content: Price | BuilderContent | null }
interface Attempt { id: string; startedAt: string; finishedAt: string | null; status: 'RUNNING' | 'PASS' | 'FAIL'; code: string | null; summary: string }
interface Journal {
  owner: typeof OWNER; version: 1; runId: string; fixtureRun: string; catalogRun: string; catalogHash: string; tenantId: string; tenantSlug: 'lac-van'; actorId: string;
  generation: number; createdAt: string; updatedAt: string; status: 'planned' | 'captured' | 'complete'; stage: string; planHash: string; baselineHash: string | null;
  targets: Target[]; configs: Record<M4Locale, M4Variant | null>; homes: Record<M4Locale, M4Variant | null>; operations: Record<string, PriceUnitOperation>; attempts: Attempt[];
}
export function originalPriceUnit(service: string, locale: M4Locale): string {
  lacVanPriceUnit(service, locale); // Reject keys outside this six-service plan.
  return changed(service) ? locale === 'vi' ? 'răng / kế hoạch' : 'tooth / plan' : locale === 'vi' ? 'lần' : 'visit';
}
/** The source is the captured original CMS record, not freshly generated pricing content. */
export function priceUnitOnlyContent(service: string, locale: M4Locale, source: M4Content): Price {
  assert('kind' in source && source.kind === 'price' && source.price.unit === originalPriceUnit(service, locale), 'ORIGINAL_PRICE_UNIT_CHANGED');
  const content = parseM4Content('price', { ...source, price: { ...source.price, unit: lacVanPriceUnit(service, locale) } }) as Price;
  assert(equal({ ...content, price: { ...content.price, unit: source.price.unit } }, source), 'NON_UNIT_PRICE_CONTENT_CHANGED'); return content;
}
export interface PricePinReplacement { id: string; priorPublicationId: string; publicationId: string; changed: boolean }
/** Preserve the current CMS page and the two unchanged prices; replace only four owned pins. */
export function replacePricePagePins(source: BuilderContent, pins: PricePinReplacement[]): BuilderContent {
  assert(source.kind === 'page' && pins.length === 6 && new Set(pins.map(p => p.id)).size === 6 && pins.filter(p => p.changed).length === 4 && pins.every(p => uuid(p.id) && uuid(p.priorPublicationId) && uuid(p.publicationId) && (p.changed ? p.publicationId !== p.priorPublicationId : p.publicationId === p.priorPublicationId)), 'INVALID_PRICE_PIN_REPLACEMENTS');
  const content = structuredClone(source), sections = content.sections.filter((s): s is ReferenceSection => s.type === 'prices'), refs = sections.flatMap(s => s.references);
  assert(sections.length > 0 && refs.length === 6 && new Set(refs.map(r => r.id)).size === 6, 'EXACT_SIX_PRICE_PINS_REQUIRED');
  for (const ref of refs) { const pin = pins.find(p => p.id === ref.id); assert(ref.kind === 'price' && pin && ref.publicationId === pin.priorPublicationId, 'ORIGINAL_PAGE_PRICE_PIN_CHANGED'); if (pin.changed) ref.publicationId = pin.publicationId; }
  const parsed = parseM4Content('page', content) as BuilderContent, reversed = structuredClone(parsed);
  for (const section of reversed.sections) if (section.type === 'prices') for (const ref of section.references) ref.publicationId = pins.find(p => p.id === ref.id)!.priorPublicationId;
  assert(equal(reversed, source), 'NON_PIN_PRICE_PAGE_CONTENT_CHANGED'); return parsed;
}
function state(v: M4Variant) { return { id: v.id, tenantId: v.tenantId, kind: v.kind, locale: v.locale, version: v.version, publicationVersion: v.publicationVersion, publicationRevision: v.publicationRevision, publishedVersion: v.publishedVersion, activePublication: v.activePublication, publicationId: v.publicationId, slugLocked: v.slugLocked, legacy: v.legacy, legacyCurrent: v.legacySource?.current ?? null, content: v.content }; }
const savedState = (before: M4Variant, content: M4Content): M4Variant => ({ ...before, version: before.version + 1, content });
const publishedState = (saved: M4Variant, publicationId: string): M4Variant => ({ ...saved, publicationVersion: saved.publicationVersion + 1, publicationRevision: saved.publicationRevision + 1, activePublication: true, publicationId, publishedVersion: saved.version, slugLocked: true });
export function assertPriceUnitResumeState(current: M4Variant, expected: M4Variant, pending: Step | null, content: M4Content, attempted: boolean): void {
  if (equal(state(current), state(expected))) return;
  const after = pending === 'save' ? savedState(expected, content) : pending === 'publish' && uuid(current.publicationId) && current.publicationId !== expected.publicationId ? publishedState(expected, current.publicationId) : null;
  assert(attempted && after && equal(state(current), state(after)), 'OWNED_PRICE_CURRENT_STATE_CHANGED');
}
export function assertPriceUnitOperationTransition(before: PriceUnitOperation, after: PriceUnitOperation): void {
  assert(before.id === after.id && (!before.request || equal(before.request, after.request) && before.requestHash === after.requestHash) && (!before.attempted || after.attempted) && (!before.reply || equal(before.reply, after.reply) && before.replyHash === after.replyHash), 'FROZEN_PRICE_OPERATION_CHANGED');
}
const opKey = (t: Target, step: Step) => `${t.key}:${step}`;
const targetPath = (j: Journal, t: Target) => M4_ROUTES.resource(j.tenantId, t.kind, t.id, t.locale);
function entry(c: LacVanCatalog, t: Target) { const e = c.entries.find(e => e.key === t.catalogKey); assert(e && e.kind === t.kind && e.id === t.id && e.slug === t.slug, 'CATALOG_PRICE_TARGET_CHANGED'); return e; }
function clean(v: M4Variant, j: Pick<Journal, 'tenantId'>, kind: M4Variant['kind'], id: string, locale: M4Locale) {
  assert(v.id === id && v.tenantId === j.tenantId && v.kind === kind && v.locale === locale && !v.virtual && !v.legacy && v.activePublication && uuid(v.publicationId) && v.publishedVersion === v.version && Number.isSafeInteger(v.version) && v.version > 0 && v.publicationVersion > 0 && v.publicationRevision > 0, 'CLEAN_PUBLISHED_PRICE_BASELINE_REQUIRED');
}
function originalPrice(c: LacVanCatalog, t: Target, current: M4Variant) {
  const e = entry(c, t), pin = e.pins[t.locale], save = c.operations[`save-${e.key}-${t.locale}`], pub = c.operations[`publish-${e.key}-${t.locale}`];
  assert(pin && save?.completed && pub?.completed && save.bodyHash === hash(save.body) && save.intentHash === hash(save.body.content) && pin.contentHash === hash(save.body.content) && pub.intentHash === hash({ content: save.body.content, id: t.id, locale: t.locale }), 'ORIGINAL_PRICE_RECEIPTS_REQUIRED');
  assert(pub.resultHash === hash({ id: t.id, kind: 'price', locale: t.locale, version: pin.version, publicationId: pin.publicationId, content: save.body.content }), 'ORIGINAL_PRICE_PUBLICATION_RECEIPT_CHANGED');
  clean(current, c, 'price', t.id, t.locale);
  assert(current.version === pin.version && current.publicationVersion === pin.publicationVersion && current.publicationRevision === pin.publicationRevision && current.publicationId === pin.publicationId && hash(current.content) === pin.contentHash && equal(current.content, save.body.content), 'ORIGINAL_PRICE_BASELINE_CHANGED');
}
function replacements(j: Journal, c: LacVanCatalog, locale: M4Locale, placeholder = false): PricePinReplacement[] {
  return j.targets.filter(t => t.kind === 'price' && t.locale === locale).map(t => {
    const priorPublicationId = entry(c, t).pins[locale]!.publicationId, op = j.operations[opKey(t, 'publish')];
    const publicationId = !t.changed ? priorPublicationId : placeholder ? op.id : op.reply?.draft.publicationId; assert(uuid(publicationId), 'NEW_PRICE_PUBLICATION_REQUIRED'); return { id: t.id, priorPublicationId, publicationId, changed: t.changed };
  });
}
function baseline(j: Journal) { return { prices: j.targets.filter(t => t.kind === 'price').map(t => ({ key: t.key, before: t.before, content: t.content })), pages: j.targets.filter(t => t.kind === 'page').map(t => ({ key: t.key, before: t.before })), configs: j.configs, homes: j.homes }; }
function anchor(j: Journal) { return { owner: j.owner, version: j.version, runId: j.runId, fixtureRun: j.fixtureRun, catalogRun: j.catalogRun, catalogHash: j.catalogHash, tenantId: j.tenantId, tenantSlug: j.tenantSlug, actorId: j.actorId, units: LACVAN_PRICE_UNITS, targets: j.targets.map(t => ({ key: t.key, catalogKey: t.catalogKey, service: t.service, kind: t.kind, changed: t.changed, id: t.id, slug: t.slug, locale: t.locale })), operations: Object.entries(j.operations).map(([key, o]) => ({ key, id: o.id })) }; }
function expectedRequest(j: Journal, t: Target, step: Step): Request {
  assert(t.changed && t.before && t.content && j.configs[t.locale]?.publicationId, 'CAPTURED_PRICE_BASELINE_REQUIRED');
  const before = t.before, operationId = j.operations[opKey(t, step)].id, path = targetPath(j, t);
  return step === 'save' ? { path, method: 'PUT', body: { operationId, expectedVersion: before.version, content: t.content, ...(before.legacySource ? { expectedLegacyState: before.legacySource.current } : {}) } }
    : { path: path + '/publish', method: 'POST', body: { operationId, expectedVersion: before.version + 1, expectedPublicationVersion: before.publicationVersion, expectedPublicationRevision: before.publicationRevision, expectedConfigPublicationId: j.configs[t.locale]!.publicationId } };
}
function validateReply(j: Journal, t: Target, step: Step, reply: M4CommandResult) {
  assert(t.before && t.content && reply.operationId === j.operations[opKey(t, step)].id && typeof reply.replayed === 'boolean' && !reply.permission, 'PRICE_COMMAND_RECEIPT_CHANGED');
  const saved = savedState(t.before, t.content), expected = step === 'save' ? saved : publishedState(saved, reply.draft.publicationId!);
  assert(step !== 'publish' || uuid(reply.draft.publicationId) && reply.draft.publicationId !== t.before.publicationId, 'NEW_PRICE_PUBLICATION_RECEIPT_REQUIRED');
  assert(equal(state(reply.draft), state(expected)), 'PRICE_COMMAND_STATE_CHANGED');
}
function validate(j: Journal, c: LacVanCatalog, f: LacVanFixtures, catalogHash: string) {
  validateLacVanCatalog(c, f);
  assert(c.status === 'catalog-ready' && j.owner === OWNER && j.version === 1 && uuid(j.runId) && j.fixtureRun === f.runId && j.catalogRun === c.runId && j.catalogHash === catalogHash && j.tenantId === c.tenantId && j.tenantSlug === 'lac-van' && j.actorId === c.actorId && j.planHash === hash(anchor(j)), 'PRICE_UNITS_OWNERSHIP_OR_PLAN_CHANGED');
  assert(Number.isSafeInteger(j.generation) && j.generation >= 0 && ['planned', 'captured', 'complete'].includes(j.status) && j.targets.length === 14 && j.attempts.length <= 50 && Object.keys(j.configs).sort().join(',') === 'en,vi' && Object.keys(j.homes).sort().join(',') === 'en,vi', 'INVALID_PRICE_UNITS_JOURNAL');
  const wanted = [...services.flatMap(s => locales.map(l => `price-${s}:${l}`)), ...locales.map(l => `page-prices:${l}`)];
  assert(equal(j.targets.map(t => t.key), wanted) && j.targets.filter(t => t.changed).length === 10 && Object.keys(j.operations).length === 20, 'INVALID_PRICE_UNIT_TARGETS');
  const ids = new Set<string>(); let blocked = false;
  for (const t of j.targets) {
    assert(locales.includes(t.locale) && t.kind === (t.service ? 'price' : 'page') && (t.service === null || services.includes(t.service)) && t.changed === (t.service === null || changed(t.service)) && t.catalogKey === (t.service ? `price-${t.service}` : 'page-prices') && t.key === `${t.catalogKey}:${t.locale}`, 'INVALID_PRICE_UNIT_TARGET'); entry(c, t);
    if (j.baselineHash) {
      assert(t.before, 'PRICE_BASELINE_MISSING'); clean(t.before, j, t.kind, t.id, t.locale);
      if (t.service) { originalPrice(c, t, t.before); assert(equal(t.content, priceUnitOnlyContent(t.service, t.locale, t.before.content)), 'PLANNED_PRICE_UNIT_CHANGED'); if (!t.changed) assert(equal(t.content, t.before.content), 'UNCHANGED_PRICE_CONTENT_CHANGED'); }
      else { assert('sections' in t.before.content && t.before.content.kind === 'page', 'PRICE_PAGE_CONTENT_REQUIRED'); replacePricePagePins(t.before.content, replacements(j, c, t.locale, true)); if (t.content) assert(equal(t.content, replacePricePagePins(t.before.content, replacements(j, c, t.locale))), 'NON_PIN_PRICE_PAGE_CHANGED'); }
    } else assert(t.before === null && t.content === null, 'UNCAPTURED_PRICE_BASELINE_CHANGED');
    if (!t.changed) continue;
    for (const step of ['save', 'publish'] as const) {
      const op = j.operations[opKey(t, step)]; assert(op && uuid(op.id) && !ids.has(op.id) && typeof op.attempted === 'boolean', 'INVALID_PRICE_OPERATION'); ids.add(op.id);
      if (op.request) assert(j.baselineHash && op.requestHash === hash(op.request) && equal(op.request, expectedRequest(j, t, step)), 'PRICE_REQUEST_CHANGED'); else assert(op.requestHash === null && !op.attempted && op.reply === null, 'MISSING_PRICE_REQUEST');
      if (op.reply) { assert(op.attempted && op.replyHash === hash(op.reply), 'PRICE_RECEIPT_HASH_CHANGED'); validateReply(j, t, step, op.reply); } else assert(op.replyHash === null, 'MISSING_PRICE_RECEIPT');
      assert(!blocked || !op.attempted, 'PRICE_COMMAND_ORDER_CHANGED'); if (!op.reply) blocked = true;
    }
  }
  assert(j.baselineHash === null ? j.status === 'planned' && locales.every(l => j.configs[l] === null && j.homes[l] === null) : j.baselineHash === hash(baseline(j)) && j.status !== 'planned', 'FROZEN_PRICE_BASELINE_CHANGED');
  if (j.baselineHash) for (const locale of locales) { const config = j.configs[locale], home = j.homes[locale], e = c.entries.find(e => e.key === 'home'); assert(config && home && e?.id, 'READ_ONLY_BASELINES_REQUIRED'); clean(config, j, 'config', j.tenantId, locale); clean(home, j, 'home', e.id, locale); }
  if (j.status === 'complete') assert(Object.values(j.operations).every(o => o.reply), 'INCOMPLETE_PRICE_UNIT_CHECKPOINT');
  const attempts = new Set<string>(); for (const a of j.attempts) { assert(uuid(a.id) && !attempts.has(a.id) && a.summary === summaryPath(j.runId, a.id) && ['RUNNING', 'PASS', 'FAIL'].includes(a.status) && (a.status === 'RUNNING' ? a.finishedAt === null : typeof a.finishedAt === 'string'), 'INVALID_PRICE_UNIT_ATTEMPT'); attempts.add(a.id); }
}
function plan(c: LacVanCatalog, f: LacVanFixtures, catalogHash: string): Journal {
  validateLacVanCatalog(c, f); assert(c.status === 'catalog-ready', 'COMPLETE_PRICE_CATALOG_REQUIRED');
  const targets: Target[] = [...services.flatMap(service => locales.map(locale => { const e = c.entries.find(e => e.key === `price-${service}`)!; assert(e?.id && e.pins[locale], 'ORIGINAL_PRICE_TARGET_REQUIRED'); return { key: `${e.key}:${locale}`, catalogKey: e.key, service, kind: 'price' as const, changed: changed(service), id: e.id, slug: e.slug, locale, before: null, content: null }; })), ...locales.map(locale => { const e = c.entries.find(e => e.key === 'page-prices')!; assert(e?.id, 'OWNED_PRICE_PAGE_REQUIRED'); return { key: `${e.key}:${locale}`, catalogKey: e.key, service: null, kind: 'page' as const, changed: true, id: e.id, slug: e.slug, locale, before: null, content: null }; })];
  const j: Journal = { owner: OWNER, version: 1, runId: randomUUID(), fixtureRun: f.runId, catalogRun: c.runId, catalogHash, tenantId: c.tenantId, tenantSlug: 'lac-van', actorId: c.actorId, generation: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'planned', stage: 'planned', planHash: '', baselineHash: null, targets, configs: { vi: null, en: null }, homes: { vi: null, en: null }, operations: {}, attempts: [] };
  for (const t of targets.filter(t => t.changed)) for (const step of ['save', 'publish'] as const) j.operations[opKey(t, step)] = { id: randomUUID(), request: null, requestHash: null, attempted: false, reply: null, replyHash: null };
  j.planHash = hash(anchor(j)); validate(j, c, f, catalogHash); return j;
}
const summaryPath = (run: string, attempt: string) => `docs/evidence/lacvan/price-units-${run}-${attempt}.json`;
async function safeDirectory() { const d = await lstat('.local'); assert(d.isDirectory() && !d.isSymbolicLink() && d.uid === process.getuid?.() && (d.mode & 0o777) === 0o700, 'UNSAFE_PRICE_UNITS_DIRECTORY'); }
async function privateText(path: string) { await safeDirectory(); const m = await lstat(path); assert(m.isFile() && !m.isSymbolicLink() && m.nlink === 1 && m.uid === process.getuid?.() && (m.mode & 0o777) === 0o600 && m.size <= 4_194_304, 'UNSAFE_PRICE_UNITS_INPUT'); return readFile(path, 'utf8'); }
async function lock(f: LacVanFixtures) {
  await safeDirectory(); const value = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, nonce: randomUUID(), pid: process.pid };
  try { await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'EEXIST') throw e; const old = JSON.parse(await privateText(LOCK)) as typeof value; assert(old.owner === OWNER && old.fixtureRun === f.runId && old.tenantId === f.tenant.id && uuid(old.nonce) && Number.isSafeInteger(old.pid) && old.pid > 1, 'UNOWNED_PRICE_UNITS_LOCK'); let dead = false; try { process.kill(old.pid, 0); } catch (error) { dead = !!error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'; } assert(dead && equal(old, JSON.parse(await privateText(LOCK))), 'PRICE_UNITS_ALREADY_RUNNING'); await unlink(LOCK); await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  return async () => { assert(equal(value, JSON.parse(await privateText(LOCK))), 'PRICE_UNITS_LOCK_CHANGED'); await unlink(LOCK); };
}
class Runner {
  constructor(readonly j: Journal, private readonly c: LacVanCatalog, private readonly f: LacVanFixtures, private readonly http: LacVanHttp) {}
  private async store() {
    const previous = JSON.parse(await privateText(PATH)) as Journal; validate(previous, this.c, this.f, this.j.catalogHash);
    assert(previous.runId === this.j.runId && previous.generation === this.j.generation && previous.planHash === this.j.planHash && rawHash(await privateText(CATALOG)) === this.j.catalogHash, 'PRICE_JOURNAL_OR_CATALOG_CHANGED');
    if (previous.baselineHash) assert(previous.baselineHash === this.j.baselineHash && equal(baseline(previous), baseline(this.j)), 'FROZEN_PRICE_BASELINE_CHANGED');
    for (const t of previous.targets) if (t.kind === 'page' && t.content) assert(equal(t.content, this.j.targets.find(x => x.key === t.key)?.content), 'FROZEN_PRICE_PAGE_PIN_PLAN_CHANGED');
    for (const [key, op] of Object.entries(previous.operations)) assertPriceUnitOperationTransition(op, this.j.operations[key]);
    assert(this.j.attempts.length >= previous.attempts.length, 'PRICE_ATTEMPT_REMOVED');
    for (let i = 0; i < previous.attempts.length; i++) { const old = previous.attempts[i], next = this.j.attempts[i]; assert(old.id === next.id && old.startedAt === next.startedAt && old.summary === next.summary && (old.status === 'RUNNING' || equal(old, next)), 'FROZEN_PRICE_ATTEMPT_CHANGED'); }
    this.j.generation++; this.j.updatedAt = new Date().toISOString(); validate(this.j, this.c, this.f, this.j.catalogHash);
    const temp = `.local/lacvan-price-units-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(this.j, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, PATH);
  }
  private async read(t: Target) { const v = await this.http.get<M4Variant>(targetPath(this.j, t)); assert(v.id === t.id && v.tenantId === this.j.tenantId && v.kind === t.kind && v.locale === t.locale, 'PRICE_READ_IDENTITY_CHANGED'); return v; }
  private async publicPage(t: Pick<Target, 'id' | 'kind' | 'locale' | 'slug'>) { const r = await this.http.get<M4Resolution>(M4_ROUTES.publicPage(this.j.tenantSlug, t.locale, t.kind, t.slug)); assert(r.resolution === 'page' && r.actualLocale === t.locale && r.page.id === t.id && r.page.kind === t.kind && r.page.actualLocale === t.locale, 'OWNED_PUBLIC_PRICE_PAGE_REQUIRED'); return r.page; }
  private async checkReadOnly() {
    for (const locale of locales) {
      const config = await this.http.get<M4Variant>(M4_ROUTES.config(this.j.tenantId, locale)), home = this.j.homes[locale];
      assert(this.j.configs[locale] && equal(state(config), state(this.j.configs[locale]!)), 'PRICE_CONFIG_BASELINE_CHANGED'); assert(home, 'READ_ONLY_HOME_REQUIRED');
      const current = await this.http.get<M4Variant>(M4_ROUTES.resource(this.j.tenantId, 'home', home.id, locale)); assert(equal(state(current), state(home)), 'READ_ONLY_HOME_CHANGED');
    }
  }
  private async capture() {
    if (this.j.baselineHash) return;
    const targets = structuredClone(this.j.targets), configs: Journal['configs'] = { vi: null, en: null }, homes: Journal['homes'] = { vi: null, en: null }, homeEntry = this.c.entries.find(e => e.key === 'home'); assert(homeEntry?.id, 'OWNED_HOME_ID_REQUIRED');
    for (const locale of locales) { const config = await this.http.get<M4Variant>(M4_ROUTES.config(this.j.tenantId, locale)), home = await this.http.get<M4Variant>(M4_ROUTES.resource(this.j.tenantId, 'home', homeEntry.id, locale)); clean(config, this.j, 'config', this.j.tenantId, locale); clean(home, this.j, 'home', homeEntry.id, locale); configs[locale] = config; homes[locale] = home; }
    for (const t of targets) {
      const current = await this.read(t); clean(current, this.j, t.kind, t.id, t.locale); t.before = current;
      if (t.service) { originalPrice(this.c, t, current); t.content = priceUnitOnlyContent(t.service, t.locale, current.content); const page = await this.publicPage(t); assert(page.publicationId === current.publicationId && equal(page.content, current.content), 'ORIGINAL_PUBLIC_PRICE_CHANGED'); }
      else { assert('sections' in current.content && current.content.kind === 'page', 'OWNED_PRICE_PAGE_CONTENT_REQUIRED'); replacePricePagePins(current.content, replacements(this.j, this.c, t.locale, true)); }
    }
    this.j.targets = targets; this.j.configs = configs; this.j.homes = homes; this.j.baselineHash = hash(baseline(this.j)); this.j.status = 'captured'; this.j.stage = 'all-price-baselines-captured'; await this.store();
  }
  private async checkCurrent(t: Target) {
    assert(t.before, 'PRICE_BASELINE_REQUIRED'); let expected = t.before;
    if (t.changed) for (const step of ['save', 'publish'] as const) { const op = this.j.operations[opKey(t, step)]; if (op.reply) expected = op.reply.draft; else { assertPriceUnitResumeState(await this.read(t), expected, step, t.content ?? t.before.content, op.attempted); return; } }
    assertPriceUnitResumeState(await this.read(t), expected, null, t.content!, false);
  }
  private async command(t: Target, step: Step) {
    const op = this.j.operations[opKey(t, step)]; if (op.reply) return op.reply; const request = expectedRequest(this.j, t, step);
    if (!op.request) { op.request = request; op.requestHash = hash(request); await this.store(); }
    assert(equal(op.request, request), 'FROZEN_PRICE_REQUEST_CHANGED'); await this.checkCurrent(t); if (step === 'publish') await this.checkReadOnly();
    if (!op.attempted) { op.attempted = true; this.j.stage = opKey(t, step); await this.store(); }
    const reply = await this.http.command<M4CommandResult>(op.request.path, op.request.method, op.request.body); validateReply(this.j, t, step, reply); op.reply = reply; op.replyHash = hash(reply); await this.store(); return reply;
  }
  private async verify() {
    await this.checkReadOnly();
    for (const t of this.j.targets) {
      assert(t.before && t.content, 'FINAL_PRICE_BASELINE_REQUIRED'); const expected = t.changed ? this.j.operations[opKey(t, 'publish')].reply?.draft : t.before; assert(expected, 'PUBLISHED_PRICE_RECEIPT_REQUIRED');
      const current = await this.read(t); assert(equal(state(current), state(expected)), 'FINAL_PRICE_HEAD_CHANGED');
      const page = await this.publicPage(t); assert(page.publicationId === expected.publicationId && equal(page.content, t.content) && page.configPublicationId === this.j.configs[t.locale]!.publicationId && page.config?.publicationId === this.j.configs[t.locale]!.publicationId, 'FINAL_PUBLIC_PRICE_CHANGED');
      if (t.kind === 'page') { const pins = replacements(this.j, this.c, t.locale), refs = page.sections.filter(s => s.section.type === 'prices').flatMap(s => s.references); assert(refs.length === 6 && new Set(refs.map(ref => ref.id)).size === 6 && refs.every(ref => { const pin = pins.find(p => p.id === ref.id), source = this.j.targets.find(x => x.id === ref.id && x.locale === t.locale); return ref.kind === 'price' && pin && source && ref.publicationId === pin.publicationId && equal(ref.content, source.content); }), 'PUBLIC_PRICE_PARENT_PINS_CHANGED'); }
    }
    for (const locale of locales) { const before = this.j.homes[locale]!, response = await this.http.get<M4Resolution>(M4_ROUTES.publicPage(this.j.tenantSlug, locale, 'home', 'home')); assert(response.resolution === 'page' && response.actualLocale === locale && response.page.id === before.id && response.page.publicationId === before.publicationId && equal(response.page.content, expectedPublicQuoteContent(before.content)), 'READ_ONLY_PUBLIC_HOME_CHANGED'); }
  }
  async run() {
    const attempt: Attempt = { id: randomUUID(), startedAt: new Date().toISOString(), finishedAt: null, status: 'RUNNING', code: null, summary: '' }; attempt.summary = summaryPath(this.j.runId, attempt.id); this.j.attempts.push(attempt); await this.store();
    try {
      await this.http.login(); await this.capture(); await this.checkReadOnly(); for (const t of this.j.targets) await this.checkCurrent(t);
      for (const t of this.j.targets.filter(t => t.changed)) {
        if (t.kind === 'page' && !t.content) { assert(t.before && 'sections' in t.before.content && t.before.content.kind === 'page', 'PRICE_PAGE_BASELINE_REQUIRED'); t.content = replacePricePagePins(t.before.content, replacements(this.j, this.c, t.locale)); await this.store(); }
        for (const step of ['save', 'publish'] as const) await this.command(t, step);
      }
      await this.verify(); this.j.status = 'complete'; this.j.stage = 'price-units-and-parent-pins-verified'; attempt.status = 'PASS';
    } catch (error) { attempt.status = 'FAIL'; attempt.code = error instanceof UnitsFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED'; }
    attempt.finishedAt = new Date().toISOString(); await this.store();
    const summary = { owner: OWNER, runId: this.j.runId, attemptId: attempt.id, status: attempt.status, code: attempt.code, stage: this.j.stage, tenantSlug: this.j.tenantSlug, fixtureRun: this.j.fixtureRun, catalogRun: this.j.catalogRun, baselineHash: this.j.baselineHash, catalogUnchanged: rawHash(await privateText(CATALOG)) === this.j.catalogHash,
      prices: this.j.targets.filter(t => t.kind === 'price').map(t => ({ service: t.service, locale: t.locale, id: t.id, changed: t.changed, beforeVersion: t.before?.version ?? null, version: t.changed ? this.j.operations[opKey(t, 'publish')].reply?.draft.version ?? null : t.before?.version ?? null, beforeUnit: t.before && 'kind' in t.before.content && t.before.content.kind === 'price' ? t.before.content.price.unit : null, unit: t.content && 'price' in t.content ? t.content.price.unit : null, beforeContentHash: t.before ? hash(t.before.content) : null, contentHash: t.content ? hash(t.content) : null, publicationId: t.changed ? this.j.operations[opKey(t, 'publish')].reply?.draft.publicationId ?? null : t.before?.publicationId ?? null })),
      pages: this.j.targets.filter(t => t.kind === 'page').map(t => ({ locale: t.locale, id: t.id, beforeVersion: t.before?.version ?? null, version: this.j.operations[opKey(t, 'publish')].reply?.draft.version ?? null, beforeContentHash: t.before ? hash(t.before.content) : null, contentHash: t.content ? hash(t.content) : null, publicationId: this.j.operations[opKey(t, 'publish')].reply?.draft.publicationId ?? null, changedFields: 'Only four existing price publicationId values', allOtherContentPreserved: attempt.status === 'PASS' ? true : null })),
      readOnly: locales.map(locale => ({ locale, configVersion: this.j.configs[locale]?.version ?? null, configPublicationId: this.j.configs[locale]?.publicationId ?? null, configContentHash: this.j.configs[locale] ? hash(this.j.configs[locale]!.content) : null, homeVersion: this.j.homes[locale]?.version ?? null, homePublicationId: this.j.homes[locale]?.publicationId ?? null, homeContentHash: this.j.homes[locale] ? hash(this.j.homes[locale]!.content) : null, unchanged: attempt.status === 'PASS' ? true : null })),
      completedCommands: Object.values(this.j.operations).filter(o => o.reply).length, credentialsPrinted: false, limits: 'Local unit-copy repair only. Eight price variants and two parent price pages use ordinary CMS save/publish. Amounts, price types, notes and references stay exact. Rendered checks remain with the coordinator.' };
    await writeFile(attempt.summary, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o644 }); console.info(JSON.stringify({ status: attempt.status, code: attempt.code, summary: attempt.summary, completedCommands: summary.completedCommands, credentialsPrinted: false })); if (attempt.status !== 'PASS') process.exitCode = 1;
  }
}
async function main() {
  assert(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).join(' ') === '--local-lacvan', 'EXPLICIT_PINNED_LOCAL_PRICE_UNITS_REQUIRED');
  const { readLacVanFixtures, privateLacVanText } = await import('./lacvan-fixtures'); const f = await readLacVanFixtures(); assert(f.status === 'complete', 'COMPLETE_CLINIC_REQUIRED'); const release = await lock(f);
  try {
    const text = await privateLacVanText(CATALOG), c = JSON.parse(text) as LacVanCatalog, catalogHash = rawHash(text); validateLacVanCatalog(c, f); let j: Journal;
    try { j = JSON.parse(await privateText(PATH)) as Journal; } catch (e) { if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ENOENT') throw e; j = plan(c, f, catalogHash); await writeFile(PATH, JSON.stringify(j, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    validate(j, c, f, catalogHash); const actor = f.identities.find(i => i.label === 'Owner'); assert(actor?.userId === j.actorId, 'OWNED_PRICE_ACTOR_REQUIRED'); await new Runner(j, c, f, new LacVanHttp(j.tenantId, j.tenantSlug, actor)).run();
  } finally { await release(); }
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'lacvan-price-units', code: error instanceof UnitsFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED', detailsRedacted: true })); process.exitCode = 1; });
