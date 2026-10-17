import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DentalContent } from '../apps/api/src/contracts/m3';
import { parseM4Content } from '../apps/api/src/contracts/m4-validation';
import { M4_ROUTES, type BuilderContent, type M4CommandResult, type M4Content, type M4Locale, type M4PermissionScope, type M4Resolution, type M4Variant, type PublicM4Page, type ReferenceSection } from '../apps/api/src/contracts/m4';
import { lacVanHash as hash, validateLacVanCatalog, type LacVanCatalog } from './lacvan-catalog';
import { LACVAN_TESTIMONIAL_QUOTES, lacVanTestimonialQuote } from './lacvan-content';
import type { LacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';

const OWNER = 'GCMS-LACVAN-QUOTES-v1', PATH = '.local/lacvan-quotes-proof.json', LOCK = '.local/lacvan-quotes-proof.lock', CATALOG = '.local/lacvan-catalog.json';
const locales: M4Locale[] = ['vi', 'en'];
const people = Object.keys(LACVAN_TESTIMONIAL_QUOTES);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const bytesHash = (s: string) => createHash('sha256').update(s).digest('hex');
const equal = (a: unknown, b: unknown) => hash(a) === hash(b);
class QuoteFailure extends Error { constructor(readonly code: string) { super(code); } }
function assert(value: unknown, code: string): asserts value { if (!value) throw new QuoteFailure(code); }
type Testimonial = Extract<DentalContent, { kind: 'testimonial' }>;
type Step = 'save' | 'text' | 'image' | 'publish';
interface Request { path: string; method: 'POST' | 'PUT'; body: Record<string, unknown> }
export interface QuoteOperation { id: string; request: Request | null; requestHash: string | null; attempted: boolean; reply: M4CommandResult | null; replyHash: string | null }
interface Target { key: string; person: string | null; kind: 'testimonial' | 'home'; id: string; slug: string; locale: M4Locale; before: M4Variant | null; content: Testimonial | BuilderContent | null }
interface Attempt { id: string; startedAt: string; finishedAt: string | null; status: 'RUNNING' | 'PASS' | 'FAIL'; code: string | null; summary: string }
interface Journal {
  owner: typeof OWNER; version: 1; runId: string; fixtureRun: string; catalogRun: string; catalogHash: string; tenantId: string; tenantSlug: 'lac-van'; actorId: string;
  generation: number; createdAt: string; updatedAt: string; planHash: string; baselineHash: string | null; status: 'planned' | 'captured' | 'complete'; stage: string;
  targets: Target[]; configs: Record<M4Locale, M4Variant | null>; operations: Record<string, QuoteOperation>; attempts: Attempt[];
}
export const originalQuote = (locale: M4Locale): string => locale === 'vi'
  ? 'Điều tôi mong chờ là được lắng nghe, hiểu rõ các lựa chọn và có thời gian đặt câu hỏi trước khi quyết định.'
  : 'What I look for is being heard, understanding the options and having time to ask questions before deciding.';

/** Accept only the original owned text. Images, attribution and all other fields stay exact. */
export function quoteOnlyContent(person: string, locale: M4Locale, source: M4Content): Testimonial {
  assert('kind' in source && source.kind === 'testimonial' && source.quote === originalQuote(locale), 'ORIGINAL_QUOTE_CHANGED');
  assert(source.image && uuid(source.image.assetId) && Number.isSafeInteger(source.image.revision) && source.image.revision > 0, 'ORIGINAL_PORTRAIT_REQUIRED');
  const content = parseM4Content('testimonial', { ...source, quote: lacVanTestimonialQuote(person, locale) }) as Testimonial;
  assert(equal({ ...content, quote: source.quote }, source), 'NON_QUOTE_CONTENT_CHANGED'); return content;
}
export function quoteRefreshScopes(content: Testimonial): [M4PermissionScope, M4PermissionScope] {
  assert(content.image && uuid(content.image.assetId) && Number.isSafeInteger(content.image.revision) && content.image.revision > 0, 'ORIGINAL_PORTRAIT_REQUIRED');
  return [{ type: 'text' }, { type: 'asset', assetId: content.image.assetId, assetRevision: content.image.revision, usage: 'page' }];
}
interface Replacement { id: string; priorPublicationId: string; publicationId: string }
/** Start from the captured CMS page, including manual edits; replace only its two existing pins. */
export function replaceHomeQuotePins(source: BuilderContent, pins: Replacement[]): BuilderContent {
  assert(source.kind === 'home' && pins.length === 4 && new Set(pins.map(p => p.id)).size === 4 && pins.every(p => uuid(p.id) && uuid(p.priorPublicationId) && uuid(p.publicationId) && p.publicationId !== p.priorPublicationId), 'INVALID_HOME_QUOTE_REPLACEMENTS');
  const content = structuredClone(source), sections = content.sections.filter((s): s is ReferenceSection => s.type === 'testimonials');
  assert(sections.length === 1 && !sections[0].hidden && sections[0].references.length === 2 && new Set(sections[0].references.map(r => r.id)).size === 2, 'EXACT_TWO_HOME_QUOTES_REQUIRED');
  for (const ref of sections[0].references) {
    const pin = pins.find(p => p.id === ref.id); assert(ref.kind === 'testimonial' && pin && ref.publicationId === pin.priorPublicationId, 'HOME_ORIGINAL_QUOTE_PIN_CHANGED'); ref.publicationId = pin.publicationId;
  }
  const parsed = parseM4Content('home', content) as BuilderContent, reversed = structuredClone(parsed);
  for (const section of reversed.sections) if (section.type === 'testimonials') for (const ref of section.references) ref.publicationId = pins.find(p => p.id === ref.id)!.priorPublicationId;
  assert(equal(reversed, source), 'NON_PIN_HOME_CONTENT_CHANGED'); return parsed;
}
/** Match 0060's public carousel envelope; resolved media/actions are checked separately. */
export function expectedPublicQuoteContent(source: M4Content): M4Content {
  const content = structuredClone(source);
  if ('sections' in content) for (const section of content.sections) if (section.type === 'hero_carousel') {
    for (const slide of section.slides) { slide.image = null; slide.action = null; }
  }
  return content;
}
function state(v: M4Variant) {
  return { id: v.id, tenantId: v.tenantId, kind: v.kind, locale: v.locale, version: v.version, publicationVersion: v.publicationVersion, publicationRevision: v.publicationRevision, publishedVersion: v.publishedVersion, activePublication: v.activePublication, publicationId: v.publicationId, slugLocked: v.slugLocked, legacy: v.legacy, legacyCurrent: v.legacySource?.current ?? null, content: v.content };
}
function savedState(before: M4Variant, content: M4Content): M4Variant { return { ...before, version: before.version + 1, content }; }
function publishedState(saved: M4Variant, publicationId: string): M4Variant { return { ...saved, publicationVersion: saved.publicationVersion + 1, publicationRevision: saved.publicationRevision + 1, activePublication: true, publicationId, publishedVersion: saved.version, slugLocked: true }; }
/** An uncertain command may be retried only against its before-state or exact possible after-state. */
export function assertQuoteResumeState(current: M4Variant, expected: M4Variant, pending: Step | null, content: M4Content, attempted: boolean): void {
  if (equal(state(current), state(expected))) return;
  const after = pending === 'save' ? savedState(expected, content) : pending === 'publish' && uuid(current.publicationId) && current.publicationId !== expected.publicationId ? publishedState(expected, current.publicationId) : null;
  assert(attempted && after && equal(state(current), state(after)), 'OWNED_CURRENT_STATE_CHANGED');
}
export function assertQuoteOperationTransition(before: QuoteOperation, after: QuoteOperation): void {
  assert(before.id === after.id && (!before.request || equal(before.request, after.request) && before.requestHash === after.requestHash) && (!before.attempted || after.attempted) && (!before.reply || equal(before.reply, after.reply) && before.replyHash === after.replyHash), 'FROZEN_QUOTE_OPERATION_CHANGED');
}
const steps = (t: Target): Step[] => t.kind === 'testimonial' ? ['save', 'text', 'image', 'publish'] : ['save', 'publish'];
const opKey = (t: Target, step: Step) => `${t.key}:${step}`;
const targetPath = (j: Journal, t: Target) => M4_ROUTES.resource(j.tenantId, t.kind, t.id, t.locale);
function entry(c: LacVanCatalog, t: Target) { const e = c.entries.find(e => e.key === (t.person ? `testimonial-${t.person}` : 'home')); assert(e && e.kind === t.kind && e.id === t.id && e.slug === t.slug, 'CATALOG_TARGET_CHANGED'); return e; }
function clean(v: M4Variant, j: Pick<Journal, 'tenantId'>, kind: M4Variant['kind'], id: string, locale: M4Locale) {
  assert(v.id === id && v.tenantId === j.tenantId && v.kind === kind && v.locale === locale && !v.virtual && !v.legacy && v.activePublication && uuid(v.publicationId) && v.publishedVersion === v.version && Number.isSafeInteger(v.version) && v.version > 0 && v.publicationVersion > 0 && v.publicationRevision > 0, 'CLEAN_PUBLISHED_BASELINE_REQUIRED');
}
function originalTarget(c: LacVanCatalog, t: Target, current: M4Variant) {
  const e = entry(c, t), pin = e.pins[t.locale], save = c.operations[`save-${e.key}-${t.locale}`], pub = c.operations[`publish-${e.key}-${t.locale}`];
  assert(pin && save?.completed && pub?.completed && save.bodyHash === hash(save.body) && save.intentHash === hash(save.body.content) && pin.contentHash === hash(save.body.content) && pub.intentHash === hash({ content: save.body.content, id: t.id, locale: t.locale }), 'ORIGINAL_CATALOG_RECEIPTS_REQUIRED');
  assert(pub.resultHash === hash({ id: t.id, kind: t.kind, locale: t.locale, version: pin.version, publicationId: pin.publicationId, content: save.body.content }), 'ORIGINAL_PUBLICATION_RECEIPT_CHANGED');
  clean(current, c, 'testimonial', t.id, t.locale);
  assert(current.version === pin.version && current.publicationVersion === pin.publicationVersion && current.publicationRevision === pin.publicationRevision && current.publicationId === pin.publicationId && hash(current.content) === pin.contentHash && equal(current.content, save.body.content), 'ORIGINAL_TESTIMONIAL_BASELINE_CHANGED');
}
function replacements(j: Journal, c: LacVanCatalog, locale: M4Locale, placeholder = false): Replacement[] {
  return j.targets.filter(t => t.kind === 'testimonial' && t.locale === locale).map(t => {
    const priorPublicationId = entry(c, t).pins[locale]!.publicationId, op = j.operations[opKey(t, 'publish')];
    const publicationId = placeholder ? op.id : op.reply?.draft.publicationId; assert(uuid(publicationId), 'NEW_QUOTE_PUBLICATION_REQUIRED'); return { id: t.id, priorPublicationId, publicationId };
  });
}
function baseline(j: Journal) { return { quotes: j.targets.filter(t => t.kind === 'testimonial').map(t => ({ key: t.key, before: t.before, content: t.content })), homes: j.targets.filter(t => t.kind === 'home').map(t => ({ key: t.key, before: t.before })), configs: j.configs }; }
function anchor(j: Journal) { return { owner: j.owner, version: j.version, runId: j.runId, fixtureRun: j.fixtureRun, catalogRun: j.catalogRun, catalogHash: j.catalogHash, tenantId: j.tenantId, tenantSlug: j.tenantSlug, actorId: j.actorId, quotes: LACVAN_TESTIMONIAL_QUOTES, targets: j.targets.map(t => ({ key: t.key, person: t.person, kind: t.kind, id: t.id, slug: t.slug, locale: t.locale })), operations: Object.entries(j.operations).map(([key, o]) => ({ key, id: o.id })) }; }
function expectedRequest(j: Journal, t: Target, step: Step): Request {
  assert(t.before && t.content && j.configs[t.locale]?.publicationId, 'CAPTURED_BASELINE_REQUIRED');
  const before = t.before, id = j.operations[opKey(t, step)].id, version = before.version + 1, path = targetPath(j, t);
  if (step === 'save') return { path, method: 'PUT', body: { operationId: id, expectedVersion: before.version, content: t.content, ...(before.legacySource ? { expectedLegacyState: before.legacySource.current } : {}) } };
  if (step === 'publish') return { path: path + '/publish', method: 'POST', body: { operationId: id, expectedVersion: version, expectedPublicationVersion: before.publicationVersion, expectedPublicationRevision: before.publicationRevision, expectedConfigPublicationId: j.configs[t.locale]!.publicationId } };
  assert(t.person && 'image' in t.content && t.content.image, 'QUOTED_PORTRAIT_REQUIRED');
  const scope = quoteRefreshScopes(t.content as Testimonial)[step === 'text' ? 0 : 1];
  return { path: path + '/permissions', method: 'POST', body: { operationId: id, expectedVersion: version, revision: version, scope, evidenceReference: step === 'text' ? `GCMS-LACVAN-001 original authored fictional perspective, no real patient or patient consent; quote refresh ${j.runId}.` : `GCMS-LACVAN-001 original AI fictional portrait, no real patient or patient consent; unchanged owned asset, quote refresh ${j.runId}.` } };
}
function validateReply(j: Journal, t: Target, step: Step, reply: M4CommandResult) {
  const op = j.operations[opKey(t, step)]; assert(t.before && t.content && reply.operationId === op.id && typeof reply.replayed === 'boolean', 'QUOTE_COMMAND_RECEIPT_CHANGED');
  const saved = savedState(t.before, t.content), expected = step === 'save' || step === 'text' || step === 'image' ? saved : publishedState(saved, reply.draft.publicationId!);
  assert(step !== 'publish' || uuid(reply.draft.publicationId) && reply.draft.publicationId !== t.before.publicationId, 'NEW_PUBLICATION_RECEIPT_REQUIRED');
  assert(equal(state(reply.draft), state(expected)), 'QUOTE_COMMAND_STATE_CHANGED');
  if (step === 'text' || step === 'image') {
    const p = reply.permission, body = expectedRequest(j, t, step).body;
    assert(p && uuid(p.id) && p.resourceId === t.id && p.kind === t.kind && p.locale === t.locale && p.revision === saved.version && equal(p.scope, body.scope) && p.evidenceReference === body.evidenceReference && p.grantedBy === j.actorId && p.withdrawnAt === null, 'NEW_REVISION_PERMISSION_REQUIRED');
  } else assert(!reply.permission, 'UNEXPECTED_QUOTE_PERMISSION_RECEIPT');
}
function validate(j: Journal, c: LacVanCatalog, f: LacVanFixtures, catalogHash: string) {
  validateLacVanCatalog(c, f);
  assert(c.status === 'catalog-ready' && j.owner === OWNER && j.version === 1 && uuid(j.runId) && j.fixtureRun === f.runId && j.catalogRun === c.runId && j.catalogHash === catalogHash && j.tenantId === c.tenantId && j.tenantSlug === 'lac-van' && j.actorId === c.actorId && j.planHash === hash(anchor(j)), 'QUOTES_OWNERSHIP_OR_PLAN_CHANGED');
  assert(Number.isSafeInteger(j.generation) && j.generation >= 0 && ['planned', 'captured', 'complete'].includes(j.status) && Array.isArray(j.targets) && j.targets.length === 10 && j.attempts.length <= 50, 'INVALID_QUOTES_JOURNAL');
  const wanted = [...people.flatMap(p => locales.map(l => `testimonial-${p}:${l}`)), ...locales.map(l => `home:${l}`)];
  assert(equal(j.targets.map(t => t.key), wanted) && Object.keys(j.operations).length === 36 && Object.keys(j.configs).sort().join(',') === 'en,vi', 'INVALID_QUOTES_TARGETS');
  const ids = new Set<string>(); let blocked = false;
  for (const t of j.targets) {
    assert(t.kind === (t.person ? 'testimonial' : 'home') && (t.person === null || people.includes(t.person)) && t.key === (t.person ? `testimonial-${t.person}` : 'home') + ':' + t.locale && locales.includes(t.locale), 'INVALID_QUOTES_TARGET'); entry(c, t);
    if (j.baselineHash) {
      assert(t.before, 'QUOTES_BASELINE_MISSING'); clean(t.before, j, t.kind, t.id, t.locale);
      if (t.person) { originalTarget(c, t, t.before); assert(equal(t.content, quoteOnlyContent(t.person, t.locale, t.before.content)), 'PLANNED_QUOTE_CHANGED'); }
      else { assert('kind' in t.before.content && t.before.content.kind === 'home', 'HOME_CONTENT_REQUIRED'); replaceHomeQuotePins(t.before.content, replacements(j, c, t.locale, true)); if (t.content) assert(equal(t.content, replaceHomeQuotePins(t.before.content, replacements(j, c, t.locale))), 'NON_PIN_HOME_CONTENT_CHANGED'); }
    } else assert(t.before === null && t.content === null, 'UNCAPTURED_QUOTES_BASELINE_CHANGED');
    for (const step of steps(t)) {
      const op = j.operations[opKey(t, step)]; assert(op && uuid(op.id) && !ids.has(op.id) && typeof op.attempted === 'boolean', 'INVALID_QUOTE_OPERATION'); ids.add(op.id);
      if (op.request) assert(j.baselineHash && op.requestHash === hash(op.request) && equal(op.request, expectedRequest(j, t, step)), 'QUOTE_REQUEST_CHANGED'); else assert(op.requestHash === null && !op.attempted && op.reply === null, 'MISSING_QUOTE_REQUEST');
      if (op.reply) { assert(op.attempted && op.replyHash === hash(op.reply), 'QUOTE_RECEIPT_HASH_CHANGED'); validateReply(j, t, step, op.reply); } else assert(op.replyHash === null, 'MISSING_QUOTE_RECEIPT');
      assert(!blocked || !op.attempted, 'QUOTE_COMMAND_ORDER_CHANGED'); if (!op.reply) blocked = true;
    }
  }
  assert(j.baselineHash === null ? j.status === 'planned' : j.baselineHash === hash(baseline(j)) && j.status !== 'planned', 'FROZEN_QUOTES_BASELINE_CHANGED');
  if (j.baselineHash) for (const locale of locales) { const config = j.configs[locale]; assert(config, 'CONFIG_BASELINE_MISSING'); clean(config, j, 'config', j.tenantId, locale); }
  if (j.status === 'complete') assert(Object.values(j.operations).every(o => o.reply), 'INCOMPLETE_QUOTES_CHECKPOINT');
  const attempts = new Set<string>(); for (const a of j.attempts) { assert(uuid(a.id) && !attempts.has(a.id) && a.summary === summaryPath(j.runId, a.id) && ['RUNNING', 'PASS', 'FAIL'].includes(a.status) && (a.status === 'RUNNING' ? a.finishedAt === null : typeof a.finishedAt === 'string'), 'INVALID_QUOTE_ATTEMPT'); attempts.add(a.id); }
}
function plan(c: LacVanCatalog, f: LacVanFixtures, catalogHash: string): Journal {
  validateLacVanCatalog(c, f); assert(c.status === 'catalog-ready', 'COMPLETE_CATALOG_REQUIRED');
  const targets: Target[] = [...people.flatMap(person => locales.map(locale => { const e = c.entries.find(e => e.key === `testimonial-${person}`)!; assert(e?.id && e.pins[locale], 'ORIGINAL_QUOTE_TARGET_REQUIRED'); return { key: `${e.key}:${locale}`, person, kind: 'testimonial' as const, id: e.id, slug: e.slug, locale, before: null, content: null }; })), ...locales.map(locale => { const e = c.entries.find(e => e.key === 'home')!; assert(e?.id, 'OWNED_HOME_REQUIRED'); return { key: `home:${locale}`, person: null, kind: 'home' as const, id: e.id, slug: e.slug, locale, before: null, content: null }; })];
  const j: Journal = { owner: OWNER, version: 1, runId: randomUUID(), fixtureRun: f.runId, catalogRun: c.runId, catalogHash, tenantId: c.tenantId, tenantSlug: 'lac-van', actorId: c.actorId, generation: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), planHash: '', baselineHash: null, status: 'planned', stage: 'planned', targets, configs: { vi: null, en: null }, operations: {}, attempts: [] };
  for (const t of targets) for (const step of steps(t)) j.operations[opKey(t, step)] = { id: randomUUID(), request: null, requestHash: null, attempted: false, reply: null, replyHash: null };
  j.planHash = hash(anchor(j)); validate(j, c, f, catalogHash); return j;
}
const summaryPath = (run: string, attempt: string) => `docs/evidence/lacvan/quotes-proof-${run}-${attempt}.json`;
async function safeDirectory() { const d = await lstat('.local'); assert(d.isDirectory() && !d.isSymbolicLink() && d.uid === process.getuid?.() && (d.mode & 0o777) === 0o700, 'UNSAFE_QUOTES_DIRECTORY'); }
async function privateText(path: string) { await safeDirectory(); const m = await lstat(path); assert(m.isFile() && !m.isSymbolicLink() && m.nlink === 1 && m.uid === process.getuid?.() && (m.mode & 0o777) === 0o600 && m.size <= 4_194_304, 'UNSAFE_QUOTES_INPUT'); return readFile(path, 'utf8'); }
async function lock(f: LacVanFixtures) {
  await safeDirectory(); const value = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, nonce: randomUUID(), pid: process.pid };
  try { await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'EEXIST') throw e; const old = JSON.parse(await privateText(LOCK)) as typeof value; assert(old.owner === OWNER && old.fixtureRun === f.runId && old.tenantId === f.tenant.id && uuid(old.nonce) && Number.isSafeInteger(old.pid) && old.pid > 1, 'UNOWNED_QUOTES_LOCK'); let dead = false; try { process.kill(old.pid, 0); } catch (error) { dead = !!error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'; } assert(dead && equal(old, JSON.parse(await privateText(LOCK))), 'QUOTES_ALREADY_RUNNING'); await unlink(LOCK); await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  return async () => { assert(equal(value, JSON.parse(await privateText(LOCK))), 'QUOTES_LOCK_CHANGED'); await unlink(LOCK); };
}
class Runner {
  constructor(readonly j: Journal, private readonly c: LacVanCatalog, private readonly f: LacVanFixtures, private readonly http: LacVanHttp) {}
  private async store() {
    const previous = JSON.parse(await privateText(PATH)) as Journal; validate(previous, this.c, this.f, this.j.catalogHash);
    assert(previous.runId === this.j.runId && previous.generation === this.j.generation && previous.planHash === this.j.planHash && bytesHash(await privateText(CATALOG)) === this.j.catalogHash, 'QUOTES_JOURNAL_OR_CATALOG_CHANGED');
    if (previous.baselineHash) assert(previous.baselineHash === this.j.baselineHash && equal(baseline(previous), baseline(this.j)), 'FROZEN_QUOTES_BASELINE_CHANGED');
    for (const t of previous.targets) if (t.kind === 'home' && t.content) assert(equal(t.content, this.j.targets.find(x => x.key === t.key)?.content), 'FROZEN_HOME_PIN_PLAN_CHANGED');
    for (const [key, op] of Object.entries(previous.operations)) assertQuoteOperationTransition(op, this.j.operations[key]);
    assert(this.j.attempts.length >= previous.attempts.length, 'QUOTE_ATTEMPT_REMOVED');
    for (let i = 0; i < previous.attempts.length; i++) { const old = previous.attempts[i], next = this.j.attempts[i]; assert(old.id === next.id && old.startedAt === next.startedAt && old.summary === next.summary && (old.status === 'RUNNING' || equal(old, next)), 'FROZEN_QUOTE_ATTEMPT_CHANGED'); }
    this.j.generation++; this.j.updatedAt = new Date().toISOString(); validate(this.j, this.c, this.f, this.j.catalogHash);
    const temp = `.local/lacvan-quotes-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(this.j, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, PATH);
  }
  private async read(t: Target) { const v = await this.http.get<M4Variant>(targetPath(this.j, t)); assert(v.id === t.id && v.tenantId === this.j.tenantId && v.kind === t.kind && v.locale === t.locale, 'QUOTE_READ_IDENTITY_CHANGED'); return v; }
  private async config(locale: M4Locale) { const current = await this.http.get<M4Variant>(M4_ROUTES.config(this.j.tenantId, locale)); assert(this.j.configs[locale] && equal(state(current), state(this.j.configs[locale]!)), 'CAPTURED_CONFIG_CHANGED'); }
  private async publicPage(t: Target): Promise<PublicM4Page> { const value = await this.http.get<M4Resolution>(M4_ROUTES.publicPage(this.j.tenantSlug, t.locale, t.kind, t.slug)); assert(value.resolution === 'page' && value.actualLocale === t.locale && value.page.id === t.id && value.page.kind === t.kind && value.page.actualLocale === t.locale, 'OWNED_PUBLIC_PAGE_REQUIRED'); return value.page; }
  private portrait(page: PublicM4Page, content: M4Content) { assert('kind' in content && content.kind === 'testimonial' && content.image && page.media.some(m => m.slot === 'image' && m.media.assetId === content.image!.assetId && m.media.revision === content.image!.revision), 'PUBLIC_PORTRAIT_NOT_ELIGIBLE'); }
  private async capture() {
    if (this.j.baselineHash) return;
    // Capture atomically in memory. A failed read must leave a resumable uncaptured journal.
    const configs: Journal['configs'] = { vi: null, en: null }, targets = structuredClone(this.j.targets);
    for (const locale of locales) { const config = await this.http.get<M4Variant>(M4_ROUTES.config(this.j.tenantId, locale)); clean(config, this.j, 'config', this.j.tenantId, locale); configs[locale] = config; }
    for (const t of targets) {
      const current = await this.read(t); clean(current, this.j, t.kind, t.id, t.locale); t.before = current;
      if (t.person) { originalTarget(this.c, t, current); t.content = quoteOnlyContent(t.person, t.locale, current.content); const page = await this.publicPage(t); assert(page.publicationId === current.publicationId && equal(page.content, current.content), 'ORIGINAL_PUBLIC_QUOTE_CHANGED'); this.portrait(page, current.content); }
      else { assert('kind' in current.content && current.content.kind === 'home', 'OWNED_HOME_CONTENT_REQUIRED'); replaceHomeQuotePins(current.content, replacements(this.j, this.c, t.locale, true)); }
    }
    this.j.targets = targets; this.j.configs = configs; this.j.baselineHash = hash(baseline(this.j)); this.j.status = 'captured'; this.j.stage = 'all-baselines-captured'; await this.store();
  }
  private async checkCurrent(t: Target) {
    assert(t.before, 'QUOTES_BASELINE_REQUIRED'); let expected = t.before;
    for (const step of steps(t)) { const op = this.j.operations[opKey(t, step)]; if (op.reply) expected = op.reply.draft; else { assertQuoteResumeState(await this.read(t), expected, step, t.content ?? t.before.content, op.attempted); return; } }
    assertQuoteResumeState(await this.read(t), expected, null, t.content!, false);
  }
  private async command(t: Target, step: Step) {
    const op = this.j.operations[opKey(t, step)]; if (op.reply) return op.reply;
    const request = expectedRequest(this.j, t, step);
    if (!op.request) { op.request = request; op.requestHash = hash(request); await this.store(); }
    assert(equal(op.request, request), 'FROZEN_QUOTE_REQUEST_CHANGED'); await this.checkCurrent(t);
    if (step === 'publish') await this.config(t.locale);
    if (!op.attempted) { op.attempted = true; this.j.stage = opKey(t, step); await this.store(); }
    const reply = await this.http.command<M4CommandResult>(op.request.path, op.request.method, op.request.body); validateReply(this.j, t, step, reply);
    op.reply = reply; op.replyHash = hash(reply); await this.store(); return reply;
  }
  private async verify() {
    for (const locale of locales) await this.config(locale);
    for (const t of this.j.targets) {
      const receipt = this.j.operations[opKey(t, 'publish')].reply; assert(receipt && t.content && t.before, 'PUBLISHED_QUOTE_RECEIPTS_REQUIRED');
      const current = await this.read(t); assert(equal(state(current), state(receipt.draft)), 'FINAL_QUOTE_HEAD_CHANGED');
      const page = await this.publicPage(t); assert(page.publicationId === receipt.draft.publicationId && equal(page.content, expectedPublicQuoteContent(t.content)) && page.configPublicationId === this.j.configs[t.locale]!.publicationId && page.config?.publicationId === this.j.configs[t.locale]!.publicationId, 'FINAL_PUBLIC_QUOTE_CHANGED');
      if (t.person) { this.portrait(page, t.content); for (const step of ['text', 'image'] as const) { const recorded = this.j.operations[opKey(t, step)].reply!.permission!; const p = await this.http.get<typeof recorded>(targetPath(this.j, t) + '/permissions/' + recorded.id); assert(equal(p, recorded) && p.withdrawnAt === null, 'GRANTED_QUOTE_PERMISSION_CHANGED'); } }
      else {
        assert('sections' in t.content, 'HOME_CONTENT_REQUIRED'); const refs = page.sections.filter(s => s.section.type === 'testimonials').flatMap(s => s.references), pins = replacements(this.j, this.c, t.locale);
        for (const section of t.content.sections) if (section.type === 'hero_carousel' && !section.hidden) {
          const slides = page.sections.find(s => s.section.id === section.id)?.slides;
          assert(slides && slides.length === section.slides.length && slides.every((slide, index) => {
            const source = section.slides[index];
            return slide.id === source.id && slide.title === source.title && slide.text === source.text
              && (source.image ? slide.media?.assetId === source.image.assetId && slide.media.revision === source.image.revision && !!slide.media.path : slide.media === null)
              && (source.action ? slide.action?.label === source.action.label && !!slide.action.path : slide.action === null);
          }), 'PUBLIC_HOME_CAROUSEL_CHANGED');
        }
        assert(refs.length === 2 && refs.every(ref => { const pin = pins.find(p => p.id === ref.id), source = this.j.targets.find(x => x.id === ref.id && x.locale === t.locale); if (!pin || !source || ref.publicationId !== pin.publicationId || !equal(ref.content, source.content)) return false; this.portrait({ ...page, media: ref.media }, ref.content); return true; }), 'PUBLIC_HOME_QUOTE_PINS_CHANGED');
      }
    }
  }
  async run() {
    const attempt: Attempt = { id: randomUUID(), startedAt: new Date().toISOString(), finishedAt: null, status: 'RUNNING', code: null, summary: '' }; attempt.summary = summaryPath(this.j.runId, attempt.id); this.j.attempts.push(attempt); await this.store();
    try {
      await this.http.login(); await this.capture();
      for (const locale of locales) await this.config(locale);
      for (const t of this.j.targets) await this.checkCurrent(t);
      for (const t of this.j.targets) {
        if (t.kind === 'home' && !t.content) { assert(t.before && 'kind' in t.before.content && t.before.content.kind === 'home', 'HOME_BASELINE_REQUIRED'); t.content = replaceHomeQuotePins(t.before.content, replacements(this.j, this.c, t.locale)); await this.store(); }
        for (const step of steps(t)) await this.command(t, step);
      }
      await this.verify(); this.j.status = 'complete'; this.j.stage = 'quotes-and-home-pins-verified'; attempt.status = 'PASS';
    } catch (error) { attempt.status = 'FAIL'; attempt.code = error instanceof QuoteFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED'; }
    attempt.finishedAt = new Date().toISOString(); await this.store();
    const summary = { owner: OWNER, runId: this.j.runId, attemptId: attempt.id, status: attempt.status, code: attempt.code, stage: this.j.stage, tenantSlug: this.j.tenantSlug, fixtureRun: this.j.fixtureRun, catalogRun: this.j.catalogRun, catalogUnchanged: bytesHash(await privateText(CATALOG)) === this.j.catalogHash, baselineHash: this.j.baselineHash,
      configs: locales.map(locale => ({ locale, version: this.j.configs[locale]?.version ?? null, publicationId: this.j.configs[locale]?.publicationId ?? null, contentHash: this.j.configs[locale] ? hash(this.j.configs[locale]!.content) : null, unchanged: attempt.status === 'PASS' ? true : null })),
      quotes: this.j.targets.filter(t => t.person).map(t => ({ person: t.person, locale: t.locale, id: t.id, beforeVersion: t.before?.version ?? null, version: this.j.operations[opKey(t, 'publish')].reply?.draft.version ?? null, beforePublicationId: t.before?.publicationId ?? null, publicationId: this.j.operations[opKey(t, 'publish')].reply?.draft.publicationId ?? null, beforeContentHash: t.before ? hash(t.before.content) : null, contentHash: t.content ? hash(t.content) : null, quote: t.content && 'quote' in t.content ? t.content.quote : null })),
      homes: this.j.targets.filter(t => t.kind === 'home').map(t => ({ locale: t.locale, id: t.id, beforeVersion: t.before?.version ?? null, version: this.j.operations[opKey(t, 'publish')].reply?.draft.version ?? null, beforeContentHash: t.before ? hash(t.before.content) : null, contentHash: t.content ? hash(t.content) : null, publicationId: this.j.operations[opKey(t, 'publish')].reply?.draft.publicationId ?? null, changedFields: 'Only the two existing testimonial publicationId values', publicVerification: attempt.status === 'PASS' ? 'PASS' : 'NOT_VERIFIED', allOtherContentPreserved: attempt.status === 'PASS' ? true : null })),
      limits: 'Local CMS refresh and public projection checks for eight testimonial variants and two existing homepage variants. Rendered desktop and mobile checks remain with the coordinator.', completedCommands: Object.values(this.j.operations).filter(o => o.reply).length, credentialsPrinted: false };
    await writeFile(attempt.summary, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
    console.info(JSON.stringify({ status: attempt.status, code: attempt.code, summary: attempt.summary, completedCommands: summary.completedCommands, credentialsPrinted: false }));
    if (attempt.status !== 'PASS') process.exitCode = 1;
  }
}
async function main() {
  assert(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).join(' ') === '--local-lacvan', 'EXPLICIT_PINNED_LOCAL_QUOTES_REQUIRED');
  const { readLacVanFixtures, privateLacVanText } = await import('./lacvan-fixtures'); const f = await readLacVanFixtures(); assert(f.status === 'complete', 'COMPLETE_CLINIC_REQUIRED');
  const release = await lock(f);
  try {
    const catalogText = await privateLacVanText(CATALOG), c = JSON.parse(catalogText) as LacVanCatalog, catalogHash = bytesHash(catalogText); validateLacVanCatalog(c, f);
    let j: Journal;
    try { j = JSON.parse(await privateText(PATH)) as Journal; }
    catch (e) { if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ENOENT') throw e; j = plan(c, f, catalogHash); await writeFile(PATH, JSON.stringify(j, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    validate(j, c, f, catalogHash); const actor = f.identities.find(i => i.label === 'Owner'); assert(actor?.userId === j.actorId, 'OWNED_QUOTES_ACTOR_REQUIRED');
    await new Runner(j, c, f, new LacVanHttp(j.tenantId, j.tenantSlug, actor)).run();
  } finally { await release(); }
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'lacvan-quotes-proof', code: error instanceof QuoteFailure ? error.code : 'HTTP_OR_PRIVATE_OPERATION_FAILED', detailsRedacted: true })); process.exitCode = 1; });
