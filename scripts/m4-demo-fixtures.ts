import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { M3_KINDS, M3_ROUTES, type ContentCommandResult, type ContentDraft, type ContentReference, type DentalContent } from '../apps/api/src/contracts/m3';
import { M4_ROUTES, type BuilderContent, type BuilderSection, type M4CommandResult, type M4Content, type M4Kind, type M4Locale, type M4Permission, type M4PermissionScope, type M4Resolution, type M4Variant, type SitePresentation } from '../apps/api/src/contracts/m4';
import { parseM4Content } from '../apps/api/src/contracts/m4-validation';
import { S03_ROUTES, type PublicationResult, type PublicationService, type ServiceContent, type SiteDraft } from '../apps/api/src/contracts/s03';
import { S07_ROUTES, type MediaAsset, type MediaPage, type ServiceMediaReference } from '../apps/api/src/contracts/s07';
import { DockerMediaProcessor } from '../apps/api/src/media/processor';
import { MediaStorage, readMediaStorageConfig } from '../apps/api/src/media/storage';
import { MediaWorker } from '../apps/api/src/worker/media-worker';
import { readM4Fixtures, type M4Fixtures } from './m4-fixtures';
import { selectM2WorkerEnvironment } from './start-m2-worker';

const PATH = '.local/m4-demo-fixtures.json', LOCK = '.local/m4-demo-fixtures.lock', OWNER = 'GCMS-M4-DEMO-v1';
const API = 'http://127.0.0.1:5890', ADMIN = 'http://127.0.0.1:5891';
const CARD_SOURCES = { doctorCard: 'doctor', galleryCard: 'gallery', caseCard: 'case', testimonialCard: 'testimonial', articleCard: 'article', faqCard: 'faq' } as const;
function cardSource(key: string): (typeof CARD_SOURCES)[keyof typeof CARD_SOURCES] | undefined { return Object.hasOwn(CARD_SOURCES, key) ? CARD_SOURCES[key as keyof typeof CARD_SOURCES] : undefined; }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function same(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }
function canonical(value: unknown): string { if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}'; return JSON.stringify(value); }
const contentHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export interface M4DemoEntry {
  key: string; kind: M4Kind; id: string | null; slug: string; locales: M4Locale[]; legacyCreated: boolean;
  publicationIds: Partial<Record<M4Locale, string>>; grants: Partial<Record<M4Locale, { id: string; revision: number; scope: M4PermissionScope }[]>>;
}
export interface M4DemoAsset { index: number; operationId: string; id: string | null; revision: number | null; checksum: string | null; processed: boolean }
interface Operation { id: string; path: string; method: 'POST' | 'PUT'; body: Record<string, unknown>; intentHash: string; completed: boolean; receipt: 'command' | 'unique-slug' | 'service-publication' }
interface ProtectedHome { id: string; version: number; publicationRevision: number; publicationId: string; contentHash: string; liveContentHash: string; liveContent: BuilderContent }
interface DemoConfig { baseline: M4Variant | null; bootstrapPublicationId: string | null; publicationId: string | null; content: SitePresentation | null }
export interface M4DemoFixtures {
  owner: typeof OWNER; fixtureRun: string; demoRunId: string; tenantId: string; tenantSlug: string; actorId: string;
  status: 'provisioning' | 'complete'; stage: string; createdAt: string; updatedAt: string;
  entries: M4DemoEntry[]; assets: M4DemoAsset[]; operations: Record<string, Operation>;
  configs: Record<M4Locale, DemoConfig>; representativeHome: ProtectedHome | null;
  legacyServicePublicationId: string | null;
  catalogPlan?: 'bounded-v2';
  promotionDates: Record<'active' | 'upcoming' | 'expired', { startAt: string; endAt: string }>;
  presentationPresets: Record<'clarity' | 'showcase', Pick<SitePresentation, 'theme' | 'palette' | 'font' | 'layout'>>;
  workerClaims: { assetId: string; jobId: string; workerId: string; fence: number; status: 'claimed' | 'completed' | 'failed' | 'skipped' }[];
  lastError?: { code: string; status: number | null; stage: string; recordedAt: string };
}
class DemoFailure extends Error { constructor(readonly code: string, readonly status: number | null = null) { super(code); } }
function requireThat(condition: unknown, code: string): asserts condition { if (!condition) throw new DemoFailure(code); }
async function privateJson<T>(path: string): Promise<T> {
  const meta = await lstat(path); requireThat(meta.isFile() && !meta.isSymbolicLink() && (meta.mode & 0o777) === 0o600 && meta.uid === process.getuid?.(), 'UNSAFE_PRIVATE_FILE');
  requireThat(meta.size <= 8 * 1024 * 1024, 'PRIVATE_FILE_TOO_LARGE'); return JSON.parse(await readFile(path, 'utf8')) as T;
}
export function validateM4Demo(value: M4DemoFixtures, fixtures: M4Fixtures): void {
  const tenant = fixtures.tenants.find(item => item.label === 'A'), actor = fixtures.identities.find(item => item.label === 'A1');
  requireThat(value.owner === OWNER && value.fixtureRun === fixtures.runId && uuid(value.demoRunId) && value.tenantId === tenant?.id && value.tenantSlug === tenant.slug && value.actorId === actor?.userId && ['provisioning', 'complete'].includes(value.status), 'DEMO_OWNERSHIP_MISMATCH');
  requireThat(Array.isArray(value.entries) && [24, 30].includes(value.entries.length) && new Set(value.entries.map(item => item.key)).size === value.entries.length && value.assets.length === 2, 'INVALID_DEMO_CATALOG');
  const cards = value.entries.filter(item => cardSource(item.key));
  requireThat(value.entries.length === 24 ? cards.length === 0 && value.catalogPlan === undefined : value.catalogPlan === 'bounded-v2' && cards.length === 6 && Object.entries(CARD_SOURCES).every(([key, kind]) => cards.some(item => item.key === key && item.kind === kind && same(item.locales, ['vi', 'en']))), 'INVALID_CATALOG_LEAF_PLAN');
  const prefix = `demo-${value.demoRunId.slice(0, 8)}-`;
  for (const entry of value.entries) requireThat((entry.id === null ? entry.key === 'service' : uuid(entry.id)) && (entry.key === 'home' ? entry.slug === 'home' : entry.slug.startsWith(prefix)) && entry.locales.length > 0 && entry.locales.every(locale => ['vi', 'en'].includes(locale)), 'INVALID_DEMO_ENTRY');
  for (const [index, asset] of value.assets.entries()) requireThat(asset.index === index && uuid(asset.operationId) && (asset.id === null || uuid(asset.id)) && (asset.checksum === null || /^[a-f0-9]{64}$/.test(asset.checksum)), 'INVALID_DEMO_ASSET');
  requireThat(value.legacyServicePublicationId === null || uuid(value.legacyServicePublicationId), 'INVALID_LEGACY_PUBLICATION');
  for (const operation of Object.values(value.operations)) requireThat(uuid(operation.id) && operation.path.startsWith(`/api/tenants/${value.tenantId}/`) && !/[\\\s]/.test(operation.path) && ['POST', 'PUT'].includes(operation.method) && (operation.receipt === 'unique-slug' || (operation.receipt === 'service-publication' ? operation.body.requestKey === operation.id : operation.receipt === 'command' && operation.body.operationId === operation.id)), 'INVALID_DEMO_OPERATION');
}
export async function readM4DemoFixtures(): Promise<M4DemoFixtures> { const fixture = await readM4Fixtures(), value = await privateJson<M4DemoFixtures>(PATH); validateM4Demo(value, fixture); return value; }
/** Additive resume plan. Existing entries, publications and operation journals retain their exact values. */
export function addM4DemoCatalogLeaves(demo: M4DemoFixtures): boolean {
  const cards = demo.entries.filter(item => cardSource(item.key));
  if (demo.catalogPlan === 'bounded-v2') { requireThat(cards.length === 6 && demo.entries.length === 30, 'INCOMPLETE_CATALOG_LEAF_PLAN'); return false; }
  requireThat(demo.status === 'provisioning' && cards.length === 0 && demo.entries.length === 24, 'CATALOG_PLAN_NOT_EXTENDABLE');
  const prefix = `demo-${demo.demoRunId.slice(0, 8)}-`;
  demo.entries.push(...Object.entries(CARD_SOURCES).map(([key, kind]): M4DemoEntry => ({ key, kind, id: randomUUID(), slug: prefix + kind + '-card', locales: ['vi', 'en'], legacyCreated: false, publicationIds: {}, grants: {} })));
  demo.catalogPlan = 'bounded-v2'; return true;
}
/** Pure plan construction: IDs and dates become durable before any authenticated write. */
export function planM4Demo(fixtures: M4Fixtures, homeId: string, now = new Date()): M4DemoFixtures {
  const tenant = fixtures.tenants.find(item => item.label === 'A')!, actor = fixtures.identities.find(item => item.label === 'A1')!, run = randomUUID(), prefix = `demo-${run.slice(0, 8)}-`;
  const specifications: [string, M4Kind, M4Locale[]][] = [['home', 'home', ['vi', 'en']], ...M3_KINDS.map(kind => [kind, kind, ['vi', 'en']] as [string, M4Kind, M4Locale[]]), ['service', 'service', ['vi', 'en']], ['priceRange', 'price', ['vi', 'en']], ['priceFrom', 'price', ['vi', 'en']], ['catalog', 'page', ['vi', 'en']], ['viOnly', 'page', ['vi']], ['enOnly', 'page', ['en']], ['promotion', 'promotion', ['vi', 'en']], ['promotionUpcoming', 'promotion', ['vi', 'en']], ['promotionExpired', 'promotion', ['vi', 'en']], ['landing', 'landing', ['vi', 'en']], ['landingUpcoming', 'landing', ['vi', 'en']], ['landingExpired', 'landing', ['vi', 'en']]];
  const instant = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const demo: M4DemoFixtures = { owner: OWNER, fixtureRun: fixtures.runId, demoRunId: run, tenantId: tenant.id, tenantSlug: tenant.slug, actorId: actor.userId, status: 'provisioning', stage: 'plan_saved', createdAt: now.toISOString(), updatedAt: now.toISOString(), entries: specifications.map(([key, kind, locales]) => ({ key, kind, locales, id: key === 'home' ? homeId : key === 'service' ? null : randomUUID(), slug: key === 'home' ? 'home' : prefix + key.replaceAll('_', '-').replace(/[A-Z]/g, character => '-' + character.toLowerCase()), legacyCreated: key === 'home', publicationIds: {}, grants: {} })), assets: [0, 1].map(index => ({ index, operationId: randomUUID(), id: null, revision: null, checksum: null, processed: false })), operations: {}, configs: { vi: { baseline: null, bootstrapPublicationId: null, publicationId: null, content: null }, en: { baseline: null, bootstrapPublicationId: null, publicationId: null, content: null } }, representativeHome: null, legacyServicePublicationId: null, promotionDates: { active: { startAt: instant(-1), endAt: instant(30) }, upcoming: { startAt: instant(35), endAt: instant(65) }, expired: { startAt: instant(-30), endAt: instant(-1) } }, presentationPresets: { clarity: { theme: 'clarity', palette: 'teal', font: 'system', layout: 'comfortable' }, showcase: { theme: 'showcase', palette: 'blue', font: 'serif', layout: 'comfortable' } }, workerClaims: [] };
  addM4DemoCatalogLeaves(demo); return demo;
}
async function store(demo: M4DemoFixtures): Promise<void> {
  const previous = await readM4DemoFixtures(); requireThat(previous.demoRunId === demo.demoRunId, 'MANIFEST_OWNER_CHANGED'); demo.updatedAt = new Date().toISOString();
  const temp = `.local/m4-demo-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(demo, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, PATH);
}
async function lock(demo: M4DemoFixtures): Promise<() => Promise<void>> {
  const value = { owner: OWNER, fixtureRun: demo.fixtureRun, demoRunId: demo.demoRunId, pid: process.pid };
  try { await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    const old = await privateJson<typeof value>(LOCK); requireThat(old.owner === OWNER && old.fixtureRun === demo.fixtureRun && old.demoRunId === demo.demoRunId && Number.isSafeInteger(old.pid) && old.pid > 1, 'UNOWNED_DEMO_LOCK');
    let dead = false; try { process.kill(old.pid, 0); } catch (failure) { dead = !!failure && typeof failure === 'object' && 'code' in failure && failure.code === 'ESRCH'; }
    requireThat(dead, 'DEMO_ALREADY_RUNNING'); requireThat(same(await privateJson(LOCK), old), 'DEMO_LOCK_CHANGED'); await unlink(LOCK); await writeFile(LOCK, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  }
  return async () => { requireThat(same(await privateJson(LOCK), value), 'DEMO_LOCK_CHANGED'); await unlink(LOCK); };
}
class HttpSession {
  private jar = new Map<string, string>(); private csrf = '';
  constructor(readonly tenantId: string, readonly tenantSlug: string, private readonly actor: M4Fixtures['identities'][number]) {}
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<{ status: number; value: T }> {
    requireThat(path.startsWith(`/api/tenants/${this.tenantId}/`) || path.startsWith(`/api/public/builder/${this.tenantSlug}/`) || ['/api/session', '/api/session/reauth', '/api/auth/sign-in/email'].includes(path), 'HTTP_SCOPE_REFUSED');
    requireThat(!/[\\\s]/.test(path) && !path.split('/').includes('..'), 'INVALID_HTTP_PATH');
    const multipart = body instanceof FormData, privateRequest = !path.startsWith('/api/public/'), headers: Record<string, string> = { host: '127.0.0.1:5890', origin: ADMIN, accept: 'application/json' };
    if (privateRequest && this.jar.size) headers.cookie = [...this.jar].map(([key, value]) => `${key}=${value}`).join('; ');
    if (body !== undefined && !multipart) headers['content-type'] = 'application/json'; if (method !== 'GET' && this.csrf) headers['x-csrf-token'] = this.csrf;
    const response = await fetch(API + path, { method, headers, credentials: 'omit', body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(multipart ? 25_000 : 15_000) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], at = pair.indexOf('='); if (at > 0) { const name = pair.slice(0, at), value = pair.slice(at + 1); if (value) this.jar.set(name, value); else this.jar.delete(name); } }
    const raw = await response.text(); requireThat(raw.length <= 2_097_152, 'HTTP_RESPONSE_TOO_LARGE'); let value: T; try { value = JSON.parse(raw) as T; } catch { throw new DemoFailure('INVALID_HTTP_JSON', response.status); }
    return { status: response.status, value };
  }
  async login(): Promise<void> {
    const signed = await this.request('/api/auth/sign-in/email', 'POST', { email: this.actor.email, password: this.actor.password, rememberMe: false }); requireThat(signed.status === 200, 'NORMAL_HTTP_LOGIN_FAILED');
    const session = await this.request<{ user: { id: string }; csrfToken: string; tenantMemberships: { tenantId: string }[] }>('/api/session');
    requireThat(session.status === 200 && session.value.user.id === this.actor.userId && typeof session.value.csrfToken === 'string' && session.value.tenantMemberships.some(item => item.tenantId === this.tenantId), 'NORMAL_HTTP_SESSION_MISMATCH'); this.csrf = session.value.csrfToken;
  }
  async reauth(): Promise<void> { const result = await this.request('/api/session/reauth', 'POST', { password: this.actor.password }); requireThat(result.status === 200, 'NORMAL_HTTP_REAUTH_FAILED'); }
  async get<T>(path: string): Promise<T> { const result = await this.request<T>(path); if (result.status !== 200) throw new DemoFailure('HTTP_READ_FAILED', result.status); return result.value; }
}
async function operation(demo: M4DemoFixtures, session: HttpSession, key: string, path: string, method: 'POST' | 'PUT', intent: unknown, prepare: () => Record<string, unknown>, id?: string): Promise<M4CommandResult> {
  demo.stage = key; let op = demo.operations[key];
  if (!op) { const operationId = id ?? randomUUID(); op = { id: operationId, path, method, body: { ...prepare(), operationId }, intentHash: hash(intent), completed: false, receipt: 'command' }; demo.operations[key] = op; await store(demo); }
  requireThat(op.path === path && op.method === method && op.intentHash === hash(intent), 'OPERATION_PLAN_CHANGED');
  let result = await session.request<M4CommandResult & { code?: string }>(op.path, op.method, op.body);
  if (result.status === 403 && result.value.code === 'REAUTH_REQUIRED') { await session.reauth(); result = await session.request(op.path, op.method, op.body); }
  if (![200, 201].includes(result.status)) throw new DemoFailure('HTTP_COMMAND_FAILED', result.status);
  requireThat(result.value.operationId === op.id && result.value.draft.tenantId === demo.tenantId && uuid(result.value.draft.id), 'COMMAND_RESPONSE_MISMATCH'); op.completed = true; await store(demo); return result.value;
}
function entry(demo: M4DemoFixtures, key: string): M4DemoEntry { const value = demo.entries.find(item => item.key === key); requireThat(value, 'DEMO_DEPENDENCY_MISSING'); return value; }
function refs(demo: M4DemoFixtures, locale: M4Locale, ...keys: string[]): ContentReference[] { return keys.map(key => { const item = entry(demo, key), publicationId = item.publicationIds[locale]; requireThat(item.id && publicationId && item.kind !== 'home' && item.kind !== 'page' && item.kind !== 'landing' && item.kind !== 'promotion', 'DEMO_REFERENCE_UNPUBLISHED'); return { kind: item.kind, id: item.id, publicationId } as ContentReference; }); }
function image(demo: M4DemoFixtures, index: number, locale: M4Locale): ServiceMediaReference { const asset = demo.assets[index]; requireThat(asset.id && asset.revision && asset.processed, 'DEMO_MEDIA_NOT_READY'); return { assetId: asset.id, revision: asset.revision, alt: locale === 'en' ? `Synthetic geometric illustration ${index + 1}; no person or patient` : `Hình khối tổng hợp minh họa ${index + 1}; không có người hoặc bệnh nhân` }; }
const titles: Record<string, [string, string]> = { specialty: ['Chuyên khoa minh họa M4', 'Synthetic specialty'], service_group: ['Nhóm dịch vụ minh họa M4', 'Synthetic service group'], location: ['Cơ sở tổng hợp minh họa', 'Synthetic clinic location'], service: ['Dịch vụ tổng hợp minh họa', 'Synthetic dental service'], faq: ['Cần chuẩn bị gì cho yêu cầu tư vấn?', 'How can I prepare a consultation request?'], doctor: ['Hồ sơ bác sĩ tổng hợp minh họa', 'Synthetic professional profile'], price: ['Giá chính xác minh họa', 'Synthetic exact price'], priceRange: ['Khoảng giá minh họa', 'Synthetic price range'], priceFrom: ['Giá từ minh họa', 'Synthetic starting price'], gallery: ['Cặp hình tổng hợp trước và sau', 'Synthetic before and after illustrations'], case: ['Ca tổng hợp minh họa', 'Synthetic treatment case'], testimonial: ['Đánh giá tổng hợp minh họa', 'Synthetic testimonial'], category: ['Chuyên mục minh họa', 'Synthetic knowledge category'], article: ['Bài viết minh họa về tư vấn', 'Synthetic consultation article'], catalog: ['Danh mục đầy đủ minh họa M4', 'Complete M4 section catalog'], viOnly: ['Trang chỉ xuất bản Tiếng Việt', 'Vietnamese-only information'], enOnly: ['Trang chỉ xuất bản English', 'English-only information'], promotion: ['Chương trình minh họa đang hiệu lực', 'Active synthetic promotion'], promotionUpcoming: ['Chương trình minh họa sắp bắt đầu', 'Upcoming synthetic promotion'], promotionExpired: ['Chương trình minh họa đã kết thúc', 'Expired synthetic promotion'], landing: ['Trang yêu cầu tư vấn minh họa', 'Synthetic consultation landing page'], landingUpcoming: ['Trang chương trình chưa bắt đầu', 'Upcoming promotion information'], landingExpired: ['Trang chương trình đã kết thúc', 'Expired promotion information'] };
export function demoContent(demo: M4DemoFixtures, item: M4DemoEntry, locale: M4Locale, legacyIdentity = false): M4Content {
  const en = locale === 'en', t = (vi: string, english: string) => en ? english : vi;
  requireThat(!legacyIdentity || (locale === 'vi' && (M3_KINDS as readonly string[]).includes(item.kind)), 'INVALID_LEGACY_SEED_KIND');
  const links = (...keys: string[]): ContentReference[] => { if (cardSource(item.key)) return []; if (!legacyIdentity) return refs(demo, locale, ...keys); if (item.kind !== 'price') return []; const service = entry(demo, 'service'); requireThat(service.id && demo.legacyServicePublicationId, 'LEGACY_SERVICE_UNPUBLISHED'); return [{ kind: 'service', id: service.id, publicationId: demo.legacyServicePublicationId }]; };
  const title = titles[cardSource(item.key) ?? item.key]?.[en ? 1 : 0] ?? t('Trang chủ minh họa M4', 'M4 synthetic homepage');
  const summary = t('Dữ liệu tổng hợp để kiểm chứng local; không có dữ liệu khách hàng thật.', 'Synthetic data for local verification; no real customer data.');
  const body = legacyDocument(t('Nội dung tổng hợp minh họa. Không phải thông tin điều trị, báo giá hoặc cam kết kết quả thực tế.', 'Synthetic demonstration content. This is not medical advice, an actual quote or a promised treatment result.'));
  const base = { slug: item.slug, title, summary, body, seo: { title: '', description: '' } };
  if (item.key === 'home') { const original = demo.representativeHome?.liveContent; requireThat(original && original.sections.every(section => section.type === 'rich_text' || (section.type === 'hero' && section.image === null && section.action === null)), 'REPRESENTATIVE_LIVE_SCHEMA_CHANGED'); return parseM4Content('home', { ...original, title, summary, seo: base.seo, sections: original.sections.map(section => section.type === 'hero' ? { ...section, title: 'Clear information about dental care', text: 'This synthetic local website demonstrates saved content and explicit publication.', image: null, action: null } : { ...section, body: legacyDocument('Published English information for the M4 local demonstration. No real patient or clinic claims are included.') }) }); }
  if (item.kind === 'service') return parseM4Content('service', { ...base, coverImage: image(demo, 0, locale), contentLinks: { references: links('specialty', 'service_group', 'location') } });
  if (item.kind === 'promotion') { const dates = item.key === 'promotionUpcoming' ? demo.promotionDates.upcoming : item.key === 'promotionExpired' ? demo.promotionDates.expired : demo.promotionDates.active; return parseM4Content('promotion', { ...base, kind: 'promotion', ...dates, authoredTimezone: 'Asia/Ho_Chi_Minh', conditions: t('Chỉ áp dụng cho dịch vụ, cơ sở và mức giá minh họa được liệt kê. Đây không phải ưu đãi thương mại thực tế.', 'Applies only to the listed synthetic service, location and price. This is not a real commercial offer.'), references: links('service', 'location', 'price') }); }
  if (['home', 'page', 'landing'].includes(item.kind)) {
    const sections: BuilderSection[] = [{ id: 'hero', type: 'hero', hidden: false, title, text: summary, image: image(demo, 0, locale), action: null }, { id: 'body', type: 'rich_text', hidden: false, body }];
    if (item.key === 'catalog') {
      const catalogKey = (key: string) => demo.catalogPlan === 'bounded-v2' ? Object.entries(CARD_SOURCES).find(([, source]) => source === key)?.[0] ?? key : key;
      for (const [type, keys, heading] of [['services', ['service', 'specialty', 'service_group'], t('Dịch vụ và chuyên khoa', 'Services and specialties')], ['doctors', ['doctor'], t('Bác sĩ', 'Doctors')], ['locations', ['location'], t('Cơ sở', 'Locations')], ['prices', ['price', 'priceRange', 'priceFrom'], t('Bảng giá minh họa', 'Synthetic prices')], ['cases', ['case'], t('Ca minh họa', 'Synthetic cases')], ['gallery', ['gallery'], t('Trước và sau', 'Before and after')], ['testimonials', ['testimonial'], t('Đánh giá', 'Testimonials')], ['articles', ['article'], t('Bài viết', 'Articles')], ['faq', ['faq'], t('Hỏi đáp', 'Questions and answers')]] as const) sections.push({ id: type, type, hidden: false, title: heading, references: links(...keys.map(catalogKey)), required: true });
      const promotion = entry(demo, 'promotion'); requireThat(promotion.id && promotion.publicationIds[locale], 'PROMOTION_UNPUBLISHED'); sections.push({ id: 'promotion', type: 'promotion', hidden: false, title: t('Chương trình minh họa', 'Synthetic promotion'), reference: { kind: 'promotion', id: promotion.id, publicationId: promotion.publicationIds[locale]! }, required: true });
    }
    if (item.kind === 'landing') { const promotionKey = item.key === 'landingUpcoming' ? 'promotionUpcoming' : item.key === 'landingExpired' ? 'promotionExpired' : 'promotion', promotion = entry(demo, promotionKey); requireThat(promotion.id && promotion.publicationIds[locale], 'PROMOTION_UNPUBLISHED'); const pin = { kind: 'promotion' as const, id: promotion.id, publicationId: promotion.publicationIds[locale]! }; sections.push({ id: 'promotion', type: 'promotion', hidden: false, title: t('Thông tin chương trình', 'Promotion information'), reference: pin, required: true }, { id: 'consultation', type: 'consultation', hidden: false, title: t('Gửi yêu cầu tư vấn', 'Request a consultation'), promotion: pin, serviceOptions: links('service'), locationOptions: links('location') }); const hero = sections[0]; if (hero.type === 'hero') hero.action = { label: t('Tìm hiểu dịch vụ', 'Explore the service'), target: { kind: 'service', id: entry(demo, 'service').id!, locale }, allowViFallback: false }; }
    return parseM4Content(item.kind, { kind: item.kind, slug: item.slug, title, summary, seo: base.seo, sections });
  }
  let extra: Record<string, unknown> = {};
  switch (item.kind) {
    case 'location': extra = { address: '1 Synthetic Clinic Street, Vietnam', phone: '', email: '', mapUrl: '', openingHours: [{ day: 1, closed: false, intervals: [{ opens: '08:00', closes: '12:00' }, { opens: '13:00', closes: '17:00' }] }, { day: 0, closed: true, intervals: [] }] }; break;
    case 'faq': extra = { references: links('specialty', 'service') }; break;
    case 'doctor': extra = { professionalTitle: t('Chức danh tổng hợp minh họa', 'Synthetic professional title'), credentials: [t('Chứng chỉ tổng hợp minh họa', 'Synthetic qualification supplied for this demo')], languages: ['Tiếng Việt', 'English'], image: image(demo, 0, locale), references: links('specialty', 'service', 'location') }; break;
    case 'price': extra = { price: item.key === 'priceRange' ? { type: 'range', minimum: '1500000.25', maximum: '2500000.75', currency: 'VND', unit: t('răng', 'tooth') } : { type: item.key === 'priceFrom' ? 'from' : 'exact', amount: item.key === 'priceFrom' ? '3000000' : '1250000.123456', currency: 'VND', unit: t('răng', 'tooth') }, inclusions: t('Phần bao gồm minh họa', 'Synthetic inclusions'), notes: t('Không phải báo giá thương mại thực tế.', 'This is not an actual commercial quote.'), references: links('service', 'location') }; break;
    case 'gallery': extra = { pairs: [{ before: { ...image(demo, 0, locale), caption: t('Hình khối tổng hợp trước', 'Synthetic before illustration') }, after: { ...image(demo, 1, locale), caption: t('Hình khối tổng hợp sau', 'Synthetic after illustration') } }], references: links('service', 'doctor') }; break;
    case 'case': extra = { image: image(demo, 0, locale), references: links('service', 'doctor', 'gallery') }; break;
    case 'testimonial': extra = { quote: t('Lời đánh giá tổng hợp minh họa; không phải phát biểu của khách hàng thật.', 'A synthetic demonstration testimonial, not a statement by a real customer.'), displayName: t('Biệt danh tổng hợp', 'Synthetic visitor'), attribution: t('Nguồn tổng hợp nội bộ', 'Internal synthetic source'), image: image(demo, 1, locale), references: links('service', 'doctor') }; break;
    case 'article': extra = { attribution: t('Tác giả tổng hợp minh họa', 'Synthetic demonstration author'), image: image(demo, 0, locale), references: links('category', 'doctor', 'service', 'faq') }; break;
  }
  return parseM4Content(item.kind, { ...base, kind: item.kind, references: [], ...extra });
}
export async function demoSyntheticPng(index: 0 | 1): Promise<Buffer> {
  const width = 960, height = 640, pixels = Buffer.alloc(width * height * 3), background = index ? [234, 222, 206] : [219, 237, 232], foreground = index ? [44, 91, 139] : [23, 104, 84];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const shape = index ? x > 160 && x < 780 && y > 180 && y < 440 : (x - 480) ** 2 + (y - 320) ** 2 < 190 ** 2, color = shape ? foreground : background, offset = (y * width + x) * 3; pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
async function ownedMediaWorker(demo: M4DemoFixtures, session: HttpSession): Promise<void> {
  const allowed = new Set(demo.assets.map(asset => asset.id)); let cursor: string | null = null; const seen = new Set<string>();
  do { const page: MediaPage = await session.get(S07_ROUTES.media(demo.tenantId) + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); for (const asset of page.items) if (!allowed.has(asset.id)) requireThat(![asset.processing?.status, asset.purge?.status].some(status => status && ['pending', 'processing', 'failed'].includes(status)), 'UNOWNED_MEDIA_BACKLOG'); cursor = page.nextCursor; if (cursor) { requireThat(!seen.has(cursor) && seen.size < 100, 'INVALID_MEDIA_CURSOR'); seen.add(cursor); } } while (cursor);
  const metadata = await lstat('.local/m2.env'); requireThat(metadata.isFile() && !metadata.isSymbolicLink() && (metadata.mode & 0o777) === 0o600 && metadata.uid === process.getuid?.(), 'UNSAFE_WORKER_INPUT');
  const values = Object.fromEntries((await readFile('.local/m2.env', 'utf8')).trim().split('\n').map(line => { const at = line.indexOf('='); requireThat(at > 0, 'INVALID_WORKER_INPUT'); return [line.slice(0, at), line.slice(at + 1)]; })), environment = selectM2WorkerEnvironment('s07', values, process.env);
  const worker = new MediaWorker(environment.S07_WORKER_DATABASE_URL, new MediaStorage(readMediaStorageConfig(environment)), new DockerMediaProcessor(environment.S07_DECODER_IMAGE));
  try { await worker.verifyRole(); for (let index = 0; index < 2; index++) { const pending = await Promise.all(demo.assets.map(asset => session.get<MediaAsset>(S07_ROUTES.asset(demo.tenantId, asset.id!)))); if (pending.every(asset => asset.state === 'ready')) break; const claim = await worker.claim(demo.tenantId); requireThat(claim && claim.kind === 'process' && claim.tenantId === demo.tenantId && allowed.has(claim.assetId), 'OWNED_MEDIA_CLAIM_UNAVAILABLE'); const recorded = { assetId: claim.assetId, jobId: claim.id, workerId: worker.workerId, fence: claim.fence, status: 'claimed' as 'claimed' | 'completed' | 'failed' | 'skipped' }; demo.workerClaims.push(recorded); await store(demo); recorded.status = await worker.process(claim); await store(demo); requireThat(recorded.status === 'completed', 'OWNED_MEDIA_PROCESSING_INCOMPLETE'); } }
  finally { await worker.close(); }
}
async function ensureMedia(demo: M4DemoFixtures, session: HttpSession): Promise<void> {
  for (const asset of demo.assets) { requireThat(asset.index === 0 || asset.index === 1, 'INVALID_SYNTHETIC_IMAGE_INDEX'); const png = await demoSyntheticPng(asset.index), checksum = createHash('sha256').update(png).digest('hex'); requireThat(!asset.checksum || asset.checksum === checksum, 'SYNTHETIC_IMAGE_CHANGED'); if (!asset.checksum) { asset.checksum = checksum; await store(demo); } if (!asset.id) { demo.stage = 'upload-' + asset.index; await store(demo); const form = new FormData(); form.set('operationId', asset.operationId); form.set('materialKind', 'ordinary'); form.set('file', new File([new Uint8Array(png)], `m4-synthetic-${asset.index}.png`, { type: 'image/png' })); const response = await session.request<MediaAsset>(S07_ROUTES.media(demo.tenantId), 'POST', form); requireThat(response.status === 201 && response.value.tenantId === demo.tenantId && uuid(response.value.id), 'MEDIA_UPLOAD_FAILED'); asset.id = response.value.id; asset.revision = response.value.revision; await store(demo); } }
  const before = await Promise.all(demo.assets.map(asset => session.get<MediaAsset>(S07_ROUTES.asset(demo.tenantId, asset.id!)))); if (!before.every(asset => asset.state === 'ready')) await ownedMediaWorker(demo, session);
  for (const asset of demo.assets) { const current = await session.get<MediaAsset>(S07_ROUTES.asset(demo.tenantId, asset.id!)); requireThat(current.tenantId === demo.tenantId && current.id === asset.id && current.state === 'ready' && current.materialKind === 'ordinary', 'MEDIA_NOT_READY'); asset.revision = current.revision; asset.processed = true; await store(demo); }
}
async function captureProtectedState(demo: M4DemoFixtures, session: HttpSession): Promise<void> {
  const home = entry(demo, 'home'); requireThat(home.id, 'REPRESENTATIVE_HOME_MISSING'); const draft = await session.get<M4Variant>(M4_ROUTES.resource(demo.tenantId, 'home', home.id, 'vi')), resolved = await session.get<M4Resolution>(M4_ROUTES.publicPage(demo.tenantSlug, 'vi', 'home', 'home'));
  requireThat(draft.kind === 'home' && draft.tenantId === demo.tenantId && draft.publicationId && draft.publishedVersion !== null && draft.version > draft.publishedVersion && resolved.resolution === 'page' && resolved.page.publicationId === draft.publicationId && 'kind' in resolved.page.content && resolved.page.content.kind === 'home', 'REPRESENTATIVE_PENDING_STATE_CHANGED');
  if (!demo.representativeHome) { demo.representativeHome = { id: home.id, version: draft.version, publicationRevision: draft.publicationRevision, publicationId: draft.publicationId, contentHash: contentHash(draft.content), liveContentHash: contentHash(resolved.page.content), liveContent: resolved.page.content }; home.publicationIds.vi = draft.publicationId; await store(demo); }
  else { const baseline = demo.representativeHome; requireThat(baseline.id === home.id && baseline.version === draft.version && baseline.publicationRevision === draft.publicationRevision && baseline.publicationId === draft.publicationId && baseline.contentHash === contentHash(draft.content) && baseline.liveContentHash === contentHash(resolved.page.content), 'REPRESENTATIVE_VI_PRESERVATION_FAILED'); }
  for (const locale of ['vi', 'en'] as const) if (!demo.configs[locale].baseline) { const config = await session.get<M4Variant>(M4_ROUTES.config(demo.tenantId, locale)); requireThat(config.kind === 'config' && config.id === demo.tenantId && (!config.activePublication || config.publishedVersion === config.version), 'EXISTING_CONFIG_PENDING_DRAFT'); demo.configs[locale].baseline = config; await store(demo); }
}
async function ensureLegacy(demo: M4DemoFixtures, session: HttpSession, item: M4DemoEntry): Promise<void> {
  if (item.legacyCreated) return;
  if (item.kind === 'service') {
    const desired: ServiceContent = { slug: item.slug, title: titles.service[0], summary: 'Dữ liệu tổng hợp M4 do script demo sở hữu.', body: legacyDocument('Dịch vụ tổng hợp minh họa M4; không có dữ liệu thực tế.'), seo: { title: '', description: '' }, coverImage: null };
    const key = 'legacy-service-create'; let op = demo.operations[key]; if (!op) { op = { id: randomUUID(), path: S03_ROUTES.services(demo.tenantId), method: 'POST', body: desired as unknown as Record<string, unknown>, intentHash: hash(desired), completed: false, receipt: 'unique-slug' }; demo.operations[key] = op; await store(demo); } requireThat(op.intentHash === hash(desired), 'SERVICE_CREATE_PLAN_CHANGED');
    async function find(): Promise<PublicationService | null> { let cursor: string | null = null; const seen = new Set<string>(); do { const page: { items: PublicationService[]; nextCursor: string | null } = await session.get(S03_ROUTES.services(demo.tenantId) + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); const matches = page.items.filter(value => value.slug === item.slug); requireThat(matches.length < 2, 'SERVICE_SLUG_COLLISION'); if (matches[0]) return matches[0]; cursor = page.nextCursor; if (cursor) { requireThat(!seen.has(cursor) && seen.size < 100, 'INVALID_SERVICE_CURSOR'); seen.add(cursor); } } while (cursor); return null; }
    let current = await find(); if (!current) { demo.stage = key; await store(demo); const response = await session.request<PublicationService>(op.path, 'POST', op.body); if (response.status !== 201) throw new DemoFailure('SERVICE_CREATE_FAILED', response.status); current = response.value; }
    const actual = { slug: current.slug, title: current.title, summary: current.summary, body: current.body, seo: current.seo, coverImage: current.coverImage ?? null }; requireThat(current.tenantId === demo.tenantId && uuid(current.id) && same(actual, desired), 'SERVICE_CREATE_OWNERSHIP_MISMATCH'); item.id = current.id; item.legacyCreated = true; op.completed = true; await store(demo); return;
  }
  if ((M3_KINDS as readonly string[]).includes(item.kind)) { requireThat(item.id, 'CONTENT_ID_MISSING'); const desired = demoContent(demo, item, 'vi', true) as DentalContent, result = await session.request<ContentDraft>(M3_ROUTES.resource(demo.tenantId, item.kind as DentalContent['kind'], item.id)); if (result.status === 404) { const key = 'legacy-' + item.key, opId = item.id; demo.stage = key; if (!demo.operations[key]) { demo.operations[key] = { id: opId, path: M3_ROUTES.resources(demo.tenantId, item.kind as DentalContent['kind']), method: 'POST', body: { operationId: opId, content: desired }, intentHash: hash(desired), completed: false, receipt: 'command' }; await store(demo); } const op = demo.operations[key], response = await session.request<ContentCommandResult>(op.path, op.method, op.body); requireThat(response.status === 201 && response.value.draft.id === item.id && same(response.value.draft.content, desired), 'CONTENT_CREATE_FAILED'); op.completed = true; } else requireThat(result.status === 200 && result.value.id === item.id && result.value.tenantId === demo.tenantId && same(result.value.content, desired), 'CONTENT_CREATE_OWNERSHIP_MISMATCH'); item.legacyCreated = true; await store(demo); }
}
async function readVariant(demo: M4DemoFixtures, session: HttpSession, item: M4DemoEntry, locale: M4Locale): Promise<M4Variant | null> { requireThat(item.id, 'RESOURCE_ID_MISSING'); const result = await session.request<M4Variant>(M4_ROUTES.resource(demo.tenantId, item.kind, item.id, locale)); if (result.status === 404) return null; requireThat(result.status === 200 && result.value.id === item.id && result.value.tenantId === demo.tenantId && result.value.kind === item.kind && result.value.locale === locale, 'VARIANT_IDENTITY_MISMATCH'); return result.value; }
/** M3 price identity creation requires an eligible legacy service pin before M4 adoption. */
async function ensureLegacyServicePublication(demo: M4DemoFixtures, session: HttpSession): Promise<void> {
  if (demo.legacyServicePublicationId) return;
  const service = entry(demo, 'service'); requireThat(service.id && service.legacyCreated, 'LEGACY_SERVICE_MISSING');
  const key = 'legacy-service-publish', path = S03_ROUTES.service(demo.tenantId, service.id) + '/publish'; demo.stage = key;
  let op = demo.operations[key];
  if (!op) {
    const draft = await session.get<PublicationService>(S03_ROUTES.service(demo.tenantId, service.id)), site = await session.get<SiteDraft>(S03_ROUTES.site(demo.tenantId)), id = randomUUID();
    requireThat(draft.tenantId === demo.tenantId && draft.id === service.id && !draft.activePublication && draft.publicationVersion === 0 && site.slug === demo.tenantSlug, 'LEGACY_SERVICE_CHANGED');
    const body = { expectedDraftVersion: draft.draftVersion, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedSiteVersion: site.version, requestKey: id };
    op = { id, path, method: 'POST', body, intentHash: hash({ serviceId: service.id, slug: service.slug }), completed: false, receipt: 'service-publication' }; demo.operations[key] = op; await store(demo);
  }
  requireThat(op.path === path && op.method === 'POST' && op.intentHash === hash({ serviceId: service.id, slug: service.slug }), 'LEGACY_PUBLICATION_PLAN_CHANGED');
  let result = await session.request<PublicationResult & { code?: string }>(op.path, op.method, op.body);
  if (result.status === 403 && result.value.code === 'REAUTH_REQUIRED') { await session.reauth(); result = await session.request(op.path, op.method, op.body); }
  requireThat(result.status === 200 || result.status === 201, 'LEGACY_PUBLICATION_FAILED');
  requireThat(result.value.activePublication && uuid(result.value.publicationId) && result.value.publicationVersion === 1 && result.value.draftVersion === op.body.expectedDraftVersion, 'LEGACY_PUBLICATION_RESPONSE_MISMATCH');
  demo.legacyServicePublicationId = result.value.publicationId; op.completed = true; await store(demo);
}
async function grantPatientScopes(demo: M4DemoFixtures, session: HttpSession, item: M4DemoEntry, draft: M4Variant): Promise<void> {
  if (!['case', 'gallery', 'testimonial'].includes(item.kind)) return;
  const indices = item.kind === 'gallery' ? [0, 1] : [item.kind === 'testimonial' ? 1 : 0], scopes: M4PermissionScope[] = [{ type: 'text' }, ...indices.map(index => ({ type: 'asset' as const, assetId: demo.assets[index].id!, assetRevision: demo.assets[index].revision!, usage: 'page' as const }))];
  for (const scope of scopes) { const path = M4_ROUTES.resource(demo.tenantId, item.kind, item.id!, draft.locale), key = `grant-${item.key}-${draft.locale}-${scope.type === 'text' ? 'text' : scope.assetId}`; let cursor: string | null = null, existing: M4Permission | undefined; const seen = new Set<string>(); do { const page: { items: M4Permission[]; nextCursor: string | null } = await session.get(path + '/permissions?pageSize=50' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')); existing = page.items.find(permission => permission.revision === draft.version && !permission.withdrawnAt && same(permission.scope, scope)); if (existing) break; cursor = page.nextCursor; if (cursor) { requireThat(!seen.has(cursor) && seen.size < 100, 'INVALID_PERMISSION_CURSOR'); seen.add(cursor); } } while (cursor); if (!existing) { const result = await operation(demo, session, key, path + '/permissions', 'POST', { scope, revision: draft.version }, () => ({ expectedVersion: draft.version, revision: draft.version, scope, evidenceReference: `GCMS-M4-DEMO-v1 ${demo.demoRunId}: synthetic ${draft.locale} ${scope.type}; no real patient` })); existing = result.permission; } requireThat(existing && existing.revision === draft.version && !existing.withdrawnAt && same(existing.scope, scope), 'PERMISSION_RESPONSE_MISMATCH'); const grants = item.grants[draft.locale] ?? []; if (!grants.some(grant => grant.id === existing!.id)) grants.push({ id: existing.id, revision: existing.revision, scope: existing.scope }); item.grants[draft.locale] = grants; await store(demo); }
}
async function publish(demo: M4DemoFixtures, session: HttpSession, draft: M4Variant, key: string): Promise<M4Variant> {
  const path = draft.kind === 'config' ? M4_ROUTES.config(demo.tenantId, draft.locale) : M4_ROUTES.resource(demo.tenantId, draft.kind, draft.id, draft.locale), config = draft.kind === 'config' ? null : await session.get<M4Variant>(M4_ROUTES.config(demo.tenantId, draft.locale));
  const result = await operation(demo, session, key, path + '/publish', 'POST', { contentHash: contentHash(draft.content), locale: draft.locale }, () => ({ expectedVersion: draft.version, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedConfigPublicationId: config?.publicationId ?? null })); requireThat(result.draft.activePublication && result.draft.publicationId && result.draft.publishedVersion === result.draft.version && same(result.draft.content, draft.content), 'PUBLICATION_RESPONSE_MISMATCH'); return result.draft;
}
export function demoEntryOperationKeys(demo: M4DemoFixtures, key: string, locale: M4Locale, desired: M4Content): { save: string; publish: string; supersedes: string | null } {
  const original = `save-${key}-${locale}`, saved = demo.operations[original];
  const repair = key === 'catalog' && locale === 'vi' && demo.catalogPlan === 'bounded-v2' && saved && !same(saved.body.content, desired);
  return repair ? { save: 'save-catalog-bounded-v2-vi', publish: 'publish-catalog-bounded-v2-vi', supersedes: original } : { save: original, publish: `publish-${key}-${locale}`, supersedes: null };
}
async function ensureEntry(demo: M4DemoFixtures, session: HttpSession, key: string): Promise<void> {
  const item = entry(demo, key); if (key !== 'home' && !['page', 'landing', 'promotion'].includes(item.kind)) await ensureLegacy(demo, session, item);
  for (const locale of item.locales) { if (key === 'home' && locale === 'vi') continue; const desired = demoContent(demo, item, locale); let draft = await readVariant(demo, session, item, locale);
    if (item.publicationIds[locale]) { requireThat(draft?.activePublication && draft.publicationId === item.publicationIds[locale] && draft.publishedVersion === draft.version && same(draft.content, desired), 'OWNED_PUBLICATION_CHANGED'); continue; }
    const keys = demoEntryOperationKeys(demo, key, locale, desired), saveKey = keys.save, savePath = M4_ROUTES.resource(demo.tenantId, item.kind, item.id!, locale), prior = demo.operations[saveKey];
    if (!prior && keys.supersedes) {
      const oldSave = demo.operations[keys.supersedes], oldPublish = demo.operations[`publish-${key}-${locale}`];
      requireThat(oldSave.completed && oldPublish && !oldPublish.completed && draft && !draft.virtual && draft.version === 1 && !draft.activePublication && draft.publicationId === null && same(draft.content, oldSave.body.content), 'CATALOG_V1_REPAIR_STATE_CHANGED');
    } else if (!prior && draft && !draft.virtual) throw new DemoFailure('UNOWNED_EXISTING_VARIANT');
    if (prior) { const replayed = await operation(demo, session, saveKey, prior.path, prior.method, desired, () => prior.body); draft = replayed.draft; }
    else if (!draft) { const created = await operation(demo, session, saveKey, M4_ROUTES.resources(demo.tenantId, item.kind) + '?locale=' + locale, 'POST', desired, () => ({ content: desired }), item.id!); draft = created.draft; }
    else { const saved = await operation(demo, session, saveKey, savePath, 'PUT', desired, () => ({ expectedVersion: draft!.version, content: desired, ...(draft!.legacySource?.current ? { expectedLegacyState: draft!.legacySource.current } : {}) })); draft = saved.draft; }
    requireThat(same(draft.content, desired), 'SAVED_CONTENT_MISMATCH'); await grantPatientScopes(demo, session, item, draft); draft = await publish(demo, session, draft, keys.publish); item.publicationIds[locale] = draft.publicationId!; await store(demo);
  }
}
export function demoPresentation(demo: M4DemoFixtures, locale: M4Locale, withMenu: boolean): SitePresentation {
  const baseline = demo.configs[locale].baseline; requireThat(baseline && 'theme' in baseline.content, 'CONFIG_BASELINE_MISSING'); const en = locale === 'en';
  const content: SitePresentation = { ...baseline.content, ...(en && baseline.version === 0 ? { name: 'M4 Synthetic Dental Information', footer: { intro: 'Synthetic website for local M4 verification.', body: legacyDocument('Original English demonstration information. No real customer, patient or clinic claims.') } } : {}), logo: image(demo, 0, locale), theme: 'clarity', themeVersion: 1, palette: en ? 'blue' : 'teal', font: 'system', layout: 'comfortable', menu: [] };
  if (withMenu) { const keys = ['home', 'catalog', 'service', 'doctor', 'location', 'price', 'case', 'gallery', 'testimonial', 'article', 'faq', 'promotion', 'landing', 'viOnly', 'enOnly']; content.menu = keys.map(key => { const target = entry(demo, key); requireThat(target.id, 'MENU_TARGET_MISSING'); const targetLocale = key === 'enOnly' ? 'en' : locale, label = key === 'home' ? (en ? 'Home' : 'Trang chủ') : titles[key][en ? 1 : 0]; return { id: 'demo-' + key, label: label.slice(0, 80), target: { kind: target.kind, id: target.id, locale: targetLocale }, allowViFallback: key === 'viOnly' && en }; }); }
  return content;
}
async function ensureConfig(demo: M4DemoFixtures, session: HttpSession, locale: M4Locale, withMenu: boolean): Promise<void> {
  const phase = withMenu ? 'menu' : 'bootstrap', desired = demoPresentation(demo, locale, withMenu), path = M4_ROUTES.config(demo.tenantId, locale), key = `config-save-${locale}-${phase}`, current = await session.get<M4Variant>(path), recorded = withMenu ? demo.configs[locale].publicationId : demo.configs[locale].bootstrapPublicationId;
  if (recorded) { requireThat(current.publicationId === recorded && current.publishedVersion === current.version && same(current.content, desired), 'OWNED_CONFIG_CHANGED'); return; }
  if (!demo.operations[key]) { const baseline = withMenu && locale === 'en' ? demo.configs.en.bootstrapPublicationId : demo.configs[locale].baseline?.publicationId; requireThat(current.publicationId === baseline && (!current.activePublication || current.publishedVersion === current.version), 'CONFIG_CHANGED_OUTSIDE_DEMO'); }
  const saved = await operation(demo, session, key, path, 'PUT', desired, () => ({ expectedVersion: current.version, content: desired })), published = await publish(demo, session, saved.draft, `config-publish-${locale}-${phase}`);
  if (withMenu) { demo.configs[locale].publicationId = published.publicationId; demo.configs[locale].content = desired; } else demo.configs[locale].bootstrapPublicationId = published.publicationId; await store(demo);
}
async function main(): Promise<void> {
  requireThat(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).length === 2 && process.argv.includes('--local-m4') && process.argv.includes('--synthetic-fixtures'), 'EXPLICIT_PINNED_LOCAL_M4_REQUIRED');
  const directory = await lstat('.local'); requireThat(directory.isDirectory() && !directory.isSymbolicLink() && (directory.mode & 0o777) === 0o700 && directory.uid === process.getuid?.(), 'UNSAFE_PRIVATE_DIRECTORY');
  const fixtures = await readM4Fixtures(); requireThat(fixtures.status === 'complete', 'COMPLETE_BASE_FIXTURES_REQUIRED'); const tenant = fixtures.tenants.find(item => item.label === 'A')!, actor = fixtures.identities.find(item => item.label === 'A1')!;
  let demo: M4DemoFixtures;
  try { demo = await readM4DemoFixtures(); } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; const original = await privateJson<{ owner: string; fixtureRun: string; tenantId: string; homeId: string }>('.local/m4-representative-ui.json'); requireThat(original.owner === 'GCMS-M4-representative-ui' && original.fixtureRun === fixtures.runId && original.tenantId === tenant.id && uuid(original.homeId), 'REPRESENTATIVE_MANIFEST_MISMATCH'); demo = planM4Demo(fixtures, original.homeId); validateM4Demo(demo, fixtures); await writeFile(PATH, JSON.stringify(demo, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  if (demo.status === 'complete') { console.info(JSON.stringify({ status: 'PASS', phase: 'existing_complete_m4_demo', reset: false, resources: demo.entries.length, credentialsPrinted: false })); return; }
  const release = await lock(demo); const session = new HttpSession(tenant.id, tenant.slug, actor);
  try {
    if (addM4DemoCatalogLeaves(demo)) { demo.stage = 'plan_catalog_bounded_v2'; await store(demo); }
    demo.stage = 'normal_http_login'; await store(demo); await session.login(); await captureProtectedState(demo, session); await ensureMedia(demo, session);
    // EN configuration must be explicitly published before any EN resource. VI representative configuration stays live until the final menu publication.
    if (!demo.configs.en.publicationId) await ensureConfig(demo, session, 'en', false);
    await ensureLegacy(demo, session, entry(demo, 'service')); await ensureLegacyServicePublication(demo, session);
    // Create legacy identities before any VI M4 adoption. Only price seeds need the owned legacy service pin.
    for (const item of demo.entries) if ((M3_KINDS as readonly string[]).includes(item.kind)) await ensureLegacy(demo, session, item);
    for (const key of ['specialty', 'service_group', 'location', 'category', 'service', 'faq', 'doctor', 'price', 'priceRange', 'priceFrom', 'gallery', 'case', 'testimonial', 'article', 'promotion', 'promotionUpcoming', 'promotionExpired', ...Object.keys(CARD_SOURCES), 'catalog', 'viOnly', 'enOnly', 'landing', 'landingUpcoming', 'landingExpired', 'home']) await ensureEntry(demo, session, key);
    await ensureConfig(demo, session, 'vi', true); await ensureConfig(demo, session, 'en', true); await captureProtectedState(demo, session);
    demo.status = 'complete'; demo.stage = 'complete'; delete demo.lastError; await store(demo);
    console.info(JSON.stringify({ status: 'PASS', phase: 'owned_m4_demo_complete', manifest: PATH, tenantSlug: demo.tenantSlug, resources: demo.entries.length, assets: demo.assets.length, preservedRepresentativeVI: true, activeEndsAt: demo.promotionDates.active.endAt, reset: false, credentialsPrinted: false }));
  } catch (error) { const failure = error instanceof DemoFailure ? error : new DemoFailure('UNEXPECTED_PRIVATE_FAILURE'); demo.lastError = { code: failure.code, status: failure.status, stage: demo.stage, recordedAt: new Date().toISOString() }; await store(demo); throw failure; }
  finally { await release(); }
}
if (import.meta.main) void main().catch(error => { const failure = error instanceof DemoFailure ? error : new DemoFailure('UNEXPECTED_PRIVATE_FAILURE'); console.error(JSON.stringify({ status: 'FAIL', phase: 'm4-demo-fixtures', code: failure.code, httpStatus: failure.status, detailsRedacted: true, reset: false })); process.exitCode = 1; });
