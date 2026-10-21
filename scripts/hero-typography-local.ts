import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { M4_ROUTES, m4PublicPath, type BuilderContent, type HeroCarouselSection, type HeroCarouselSlide, type M4CommandResult, type M4Locale, type M4Preview, type M4PublicConfig, type M4Resolution, type M4Variant, type SitePresentation } from '../apps/api/src/contracts/m4';
import { DentalGoHttp } from './dental-go-http';
import { privateDentalGoText, readDentalGoFixtures } from './dental-go-fixtures';
import { LacVanHttp } from './lacvan-http';
import { privateLacVanText, readLacVanFixtures } from './lacvan-fixtures';

const OWNER = 'GCMS-HERO-TYPO-001-local-v1';
const BASELINE = '.local/hero-typography-publication-baseline.json';
const JOURNAL = '.local/hero-typography-publication-journal.json';
const LOCK = '.local/hero-typography-publication.lock';
const locales = ['vi', 'en'] as const;
type SiteKey = 'dental-go-plus' | 'lac-van';
type Key = `${SiteKey}:${M4Locale}:${'home' | 'config'}`;
type Http = DentalGoHttp | LacVanHttp;
type Site = { key: SiteKey; tenantId: string; slug: string; actorId: string; homeId: string; homeSlug: string; http: Http };
type Snapshot = { key: Key; tenantId: string; slug: string; variant: M4Variant; publicId: string; publicContentHash: string };
type Baseline = { owner: typeof OWNER; createdAt: string; snapshots: Record<Key, Snapshot> };
type Operation = { id: string; key: Key; action: 'save' | 'publish'; path: string; body: Record<string, unknown>; attempted: boolean; completed: boolean; resultHash: string | null };
type Journal = { owner: typeof OWNER; baselineHash: string; createdAt: string; updatedAt: string; generation: number; phase: 'preflight' | 'saved' | 'verified' | 'published'; desired: Record<Key, BuilderContent | SitePresentation>; baselineIssues?: Record<Key, string[]>; publicBaseline?: Record<Key, BuilderContent | SitePresentation>; operations: Record<string, Operation> };

function check(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
function isHome(value: M4Variant): value is M4Variant & { content: BuilderContent } { return value.kind === 'home' && typeof value.content === 'object' && value.content !== null && 'sections' in value.content; }
function isConfig(value: M4Variant): value is M4Variant & { content: SitePresentation } { return value.kind === 'config' && typeof value.content === 'object' && value.content !== null && 'theme' in value.content; }
function carousel(content: BuilderContent): HeroCarouselSection {
  const matches = content.sections.filter((section): section is HeroCarouselSection => section.type === 'hero_carousel' && !section.hidden);
  check(matches.length === 1, 'HOME_CAROUSEL_COUNT_CHANGED'); return matches[0];
}
function phrase(title: string, value: string): void {
  const at = title.indexOf(value);
  check(at >= 0 && title.indexOf(value, at + 1) < 0, 'HIGHLIGHT_NOT_EXACT_UNIQUE_TITLE_SUBSTRING');
}
export function desiredHeroContent(key: Key, variant: M4Variant): BuilderContent | SitePresentation {
  const [site, locale, kind] = key.split(':') as [SiteKey, M4Locale, 'home' | 'config'];
  const result = structuredClone(variant.content);
  if (kind === 'config') {
    check(isConfig(variant), 'CONFIG_SHAPE_CHANGED');
    const config = result as SitePresentation;
    check(config.theme === 'signature' && config.signature, 'SIGNATURE_CONFIG_REQUIRED');
    config.signature.heroTypography = site === 'dental-go-plus' ? 'warm_editorial' : 'rose_editorial';
    return config;
  }
  check(isHome(variant), 'HOME_SHAPE_CHANGED');
  const home = result as BuilderContent, hero = carousel(home);
  const expected = site === 'dental-go-plus'
    ? locale === 'vi' ? ['sự thấu hiểu.'] : ['understanding.']
    : locale === 'vi' ? ['nụ cười', 'sự thấu hiểu', 'chính bạn'] : ['every smile', 'understanding', 'yourself'];
  check(hero.slides.length === expected.length, 'HOME_SLIDE_COUNT_CHANGED');
  hero.slides.forEach((slide, index) => { phrase(slide.title, expected[index]); slide.highlight = expected[index]; });
  return home;
}
async function privateDirectory() {
  const dir = await lstat('.local');
  check(dir.isDirectory() && !dir.isSymbolicLink() && (dir.mode & 0o777) === 0o700 && dir.uid === process.getuid?.(), 'UNSAFE_PRIVATE_DIRECTORY');
}
async function privateJson<T>(path: string): Promise<T> {
  await privateDirectory(); const meta = await lstat(path);
  check(meta.isFile() && !meta.isSymbolicLink() && meta.nlink === 1 && (meta.mode & 0o777) === 0o600 && meta.uid === process.getuid?.() && meta.size <= 4_194_304, 'UNSAFE_PRIVATE_INPUT');
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
async function locked<T>(run: () => Promise<T>): Promise<T> {
  await privateDirectory(); const value = JSON.stringify({ owner: OWNER, pid: process.pid, nonce: randomUUID() });
  await writeFile(LOCK, value, { flag: 'wx', mode: 0o600 });
  try { return await run(); }
  finally { check(await readFile(LOCK, 'utf8') === value, 'OPERATOR_LOCK_CHANGED'); await unlink(LOCK); }
}
async function siteContexts(): Promise<Site[]> {
  const dental = await readDentalGoFixtures(), lacvan = await readLacVanFixtures();
  check(dental.status === 'complete' && lacvan.status === 'complete', 'FIXTURE_OWNER_NOT_READY');
  const dentalSeed = JSON.parse(await privateDentalGoText('.local/dental-go-seed.json')) as { owner: string; fixtureRun: string; tenantId: string; complete: boolean; entries: { key: string; kind: string; id: string; slug: string }[] };
  const lacvanCatalog = JSON.parse(await privateLacVanText('.local/lacvan-catalog.json')) as { owner: string; fixtureRun: string; tenantId: string; status: string; entries: { key: string; kind: string; id: string; slug: string }[] };
  check(dentalSeed.owner === 'GCMS-DENTAL-GO-PLUS-SEED-v1' && dentalSeed.fixtureRun === dental.runId && dentalSeed.tenantId === dental.tenant.id && dentalSeed.complete, 'DENTAL_GO_SEED_OWNER_MISMATCH');
  check(lacvanCatalog.owner === 'GCMS-LACVAN-CATALOG-v1' && lacvanCatalog.fixtureRun === lacvan.runId && lacvanCatalog.tenantId === lacvan.tenant.id && lacvanCatalog.status === 'catalog-ready', 'LACVAN_CATALOG_OWNER_MISMATCH');
  check(dental.tenant.slug === 'dental-go-plus' && lacvan.tenant.slug === 'lac-van', 'FIXTURE_TENANT_SLUG_MISMATCH');
  const dentalHome = dentalSeed.entries.find(item => item.key === 'home' && item.kind === 'home');
  const lacvanHome = lacvanCatalog.entries.find(item => item.key === 'home' && item.kind === 'home');
  check(dentalHome?.id && lacvanHome?.id && dentalHome.slug === 'home' && lacvanHome.slug === 'home' && dental.tenant.id !== lacvan.tenant.id, 'HOME_OWNER_MISMATCH');
  const dentalActor = dental.identities.find(identity => identity.label === 'Owner');
  const lacvanActor = lacvan.identities.find(identity => identity.label === 'Owner');
  check(dentalActor && lacvanActor, 'TENANT_ACTOR_MISSING');
  return [
    { key: 'dental-go-plus', tenantId: dental.tenant.id, slug: dental.tenant.slug, actorId: dentalActor.userId, homeId: dentalHome.id, homeSlug: dentalHome.slug, http: new DentalGoHttp(dental.tenant.id, dental.tenant.slug, dentalActor) },
    { key: 'lac-van', tenantId: lacvan.tenant.id, slug: lacvan.tenant.slug, actorId: lacvanActor.userId, homeId: lacvanHome.id, homeSlug: lacvanHome.slug, http: new LacVanHttp(lacvan.tenant.id, lacvan.tenant.slug, lacvanActor) },
  ];
}
function route(site: Site, locale: M4Locale, kind: 'home' | 'config') { return kind === 'home' ? M4_ROUTES.resource(site.tenantId, 'home', site.homeId, locale) : M4_ROUTES.config(site.tenantId, locale); }
function recordKey(site: Site, locale: M4Locale, kind: 'home' | 'config'): Key { return `${site.key}:${locale}:${kind}`; }
async function snapshot(site: Site, locale: M4Locale, kind: 'home' | 'config'): Promise<Snapshot> {
  const key = recordKey(site, locale, kind), variant = await site.http.get<M4Variant>(route(site, locale, kind));
  check(variant.tenantId === site.tenantId && variant.locale === locale && variant.kind === kind && variant.id === (kind === 'home' ? site.homeId : site.tenantId), 'VARIANT_OWNER_MISMATCH');
  check(variant.activePublication && variant.publicationId && variant.version === variant.publishedVersion, 'UNRELATED_PENDING_DRAFT');
  const publicValue = kind === 'home'
    ? await site.http.get<M4Resolution>(M4_ROUTES.publicPage(site.slug, locale, 'home', site.homeSlug))
    : await site.http.get<{ publicationId: string; content: SitePresentation }>(M4_ROUTES.publicConfig(site.slug, locale));
  if (kind === 'home') {
    const page = publicValue as M4Resolution;
    check(page.resolution === 'page' && page.actualLocale === locale && page.page.id === site.homeId && page.page.publicationId === variant.publicationId, 'PUBLIC_HOME_HEAD_MISMATCH');
    return { key, tenantId: site.tenantId, slug: site.slug, variant, publicId: page.page.publicationId, publicContentHash: hash(page.page.content) };
  }
  const config = publicValue as { publicationId: string; content: SitePresentation };
  check(config.publicationId === variant.publicationId, 'PUBLIC_CONFIG_HEAD_MISMATCH');
  return { key, tenantId: site.tenantId, slug: site.slug, variant, publicId: config.publicationId, publicContentHash: hash(config.content) };
}
async function preflight(sites: Site[]) {
  check(!await Bun.file(BASELINE).exists() && !await Bun.file(JOURNAL).exists(), 'OPERATOR_PLAN_ALREADY_EXISTS');
  const snapshots = {} as Record<Key, Snapshot>, desired = {} as Journal['desired'];
  const titles: { site: string; locale: string; slideCount: number; titles: string[] }[] = [];
  for (const site of sites) for (const locale of locales) {
    for (const kind of ['home', 'config'] as const) {
      const value = await snapshot(site, locale, kind); snapshots[value.key] = value; desired[value.key] = desiredHeroContent(value.key, value.variant);
      check(!isDeepStrictEqual(desired[value.key], value.variant.content), 'HERO_CHANGE_ALREADY_PRESENT');
      if (kind === 'home') titles.push({ site: site.key, locale, slideCount: carousel(value.variant.content as BuilderContent).slides.length, titles: carousel(value.variant.content as BuilderContent).slides.map(slide => slide.title) });
    }
  }
  const baseline: Baseline = { owner: OWNER, createdAt: new Date().toISOString(), snapshots };
  const journal: Journal = { owner: OWNER, baselineHash: hash(baseline), createdAt: baseline.createdAt, updatedAt: baseline.createdAt, generation: 0, phase: 'preflight', desired, operations: {} };
  await writeFile(BASELINE, JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(JOURNAL, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.info(JSON.stringify({ status: 'PASS', phase: 'preflight', resources: 8, pendingDrafts: 0, tenants: sites.map(site => site.key), titles, baselineHash: journal.baselineHash, credentialsPrinted: false }));
}
async function plan(): Promise<{ baseline: Baseline; journal: Journal }> {
  const baseline = await privateJson<Baseline>(BASELINE), journal = await privateJson<Journal>(JOURNAL);
  check(baseline.owner === OWNER && journal.owner === OWNER && journal.baselineHash === hash(baseline), 'BASELINE_OR_JOURNAL_OWNER_MISMATCH');
  check(Object.keys(baseline.snapshots).length === 8 && Object.keys(journal.desired).length === 8 && Number.isSafeInteger(journal.generation), 'OPERATOR_PLAN_INCOMPLETE');
  for (const [key, snapshot] of Object.entries(baseline.snapshots) as [Key, Snapshot][]) {
    check(snapshot.key === key && hash(desiredHeroContent(key, snapshot.variant)) === hash(journal.desired[key]), 'OPERATOR_INTENT_CHANGED');
  }
  return { baseline, journal };
}
async function store(journal: Journal) {
  const current = await privateJson<Journal>(JOURNAL);
  check(current.owner === OWNER && current.baselineHash === journal.baselineHash && current.generation === journal.generation, 'OPERATOR_JOURNAL_CHANGED');
  journal.generation++; journal.updatedAt = new Date().toISOString();
  const temp = `.local/hero-typography-journal-${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, JOURNAL);
}
function ordered(sites: Site[]): { site: Site; locale: M4Locale; kind: 'home' | 'config'; key: Key }[] {
  return sites.flatMap(site => locales.flatMap(locale => (['home', 'config'] as const).map(kind => ({ site, locale, kind, key: recordKey(site, locale, kind) }))));
}
async function currentVariant(site: Site, locale: M4Locale, kind: 'home' | 'config'): Promise<M4Variant> {
  const value = await site.http.get<M4Variant>(route(site, locale, kind));
  check(value.tenantId === site.tenantId && value.id === (kind === 'home' ? site.homeId : site.tenantId) && value.locale === locale && value.kind === kind, 'CURRENT_RESOURCE_OWNER_MISMATCH');
  return value;
}
function savedState(value: M4Variant, base: Snapshot, desired: BuilderContent | SitePresentation): boolean {
  const prior = base.variant;
  return value.id === prior.id && value.version === prior.version + 1 && value.publishedVersion === prior.version && value.publicationVersion === prior.publicationVersion && value.publicationRevision === prior.publicationRevision && value.publicationId === prior.publicationId && value.activePublication && isDeepStrictEqual(value.content, desired);
}
function publishedState(value: M4Variant, base: Snapshot, desired: BuilderContent | SitePresentation): boolean {
  const prior = base.variant;
  return value.id === prior.id && value.version === prior.version + 1 && value.publishedVersion === value.version && value.publicationVersion === prior.publicationVersion + 1 && value.publicationRevision === prior.publicationRevision + 1 && value.publicationId !== prior.publicationId && !!value.publicationId && value.activePublication && isDeepStrictEqual(value.content, desired);
}
async function operation(site: Site, journal: Journal, key: Key, action: 'save' | 'publish', path: string, prepare: () => Record<string, unknown>): Promise<M4CommandResult> {
  const opKey = `${action}:${key}`;
  let op = journal.operations[opKey];
  if (!op) {
    const id = randomUUID(), body = { ...prepare(), operationId: id };
    op = { id, key, action, path, body, attempted: false, completed: false, resultHash: null };
    journal.operations[opKey] = op; await store(journal);
  }
  check(op.key === key && op.action === action && op.path === path && op.body.operationId === op.id && hash(op.body) === hash({ ...prepare(), operationId: op.id }), 'OPERATOR_COMMAND_INTENT_CHANGED');
  if (!op.attempted) { op.attempted = true; await store(journal); }
  const result = await site.http.command<M4CommandResult>(path, action === 'save' ? 'PUT' : 'POST', op.body);
  check(result.operationId === op.id && result.draft.tenantId === site.tenantId, 'OPERATOR_RECEIPT_MISMATCH');
  const resultHash = hash({ id: result.draft.id, kind: result.draft.kind, locale: result.draft.locale, version: result.draft.version, publicationId: result.draft.publicationId, content: result.draft.content });
  check(!op.completed || op.resultHash === resultHash, 'OPERATOR_REPLAY_CHANGED');
  op.completed = true; op.resultHash = resultHash; await store(journal);
  return result;
}
async function baselinePreviews(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.phase === 'preflight' && !journal.baselineIssues && Object.keys(journal.operations).length === 0, 'BASELINE_PREVIEW_PHASE_CHANGED');
  const issues = {} as Record<Key, string[]>;
  for (const { site, locale, kind, key } of ordered(sites)) {
    const value = await site.http.get<M4Preview>(route(site, locale, kind) + '/preview');
    check(value.draft.id === baseline.snapshots[key].variant.id && value.draft.version === baseline.snapshots[key].variant.version, 'BASELINE_PREVIEW_DRAFT_CHANGED');
    check(Array.isArray(value.issues) && value.issues.every(issue => typeof issue === 'string'), 'BASELINE_PREVIEW_INVALID');
    issues[key] = value.issues;
  }
  journal.baselineIssues = issues; await store(journal);
  console.info(JSON.stringify({ status: 'PASS', phase: 'baseline-preview', resources: 8, issues: Object.fromEntries(Object.entries(issues).map(([key, value]) => [key, value.length])), credentialFieldsPrinted: false }));
}
async function capturePublicBaseline(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.phase === 'preflight' && journal.baselineIssues && !journal.publicBaseline && Object.keys(journal.operations).length === 0, 'PUBLIC_BASELINE_PHASE_CHANGED');
  const content = {} as Record<Key, BuilderContent | SitePresentation>;
  for (const { site, locale, kind, key } of ordered(sites)) {
    const published = kind === 'home'
      ? await site.http.get<M4Resolution>(M4_ROUTES.publicPage(site.slug, locale, 'home', site.homeSlug))
      : await site.http.get<M4PublicConfig>(M4_ROUTES.publicConfig(site.slug, locale));
    if (kind === 'home') {
      const page = published as M4Resolution;
      check(page.resolution === 'page' && page.actualLocale === locale && page.page.id === site.homeId && page.page.publicationId === baseline.snapshots[key].publicId, 'PUBLIC_BASELINE_HEAD_CHANGED');
      content[key] = page.page.content as BuilderContent;
    } else {
      const config = published as M4PublicConfig;
      check(config.locale === locale && config.publicationId === baseline.snapshots[key].publicId, 'PUBLIC_BASELINE_CONFIG_CHANGED');
      content[key] = config.content;
    }
    check(hash(content[key]) === baseline.snapshots[key].publicContentHash, 'PUBLIC_BASELINE_CONTENT_CHANGED');
  }
  journal.publicBaseline = content; await store(journal);
  console.info(JSON.stringify({ status: 'PASS', phase: 'capture-public-baseline', resources: 8, originalHashesMatched: true, credentialsPrinted: false }));
}
async function saveDrafts(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.phase === 'preflight' && journal.baselineIssues && journal.publicBaseline, 'SAVE_PHASE_OR_BASELINE_MISSING');
  const items = ordered(sites);
  for (const { site, locale, kind, key } of items) {
    const current = await currentVariant(site, locale, kind), base = baseline.snapshots[key], op = journal.operations[`save:${key}`];
    check(base.tenantId === site.tenantId && base.variant.id === current.id, 'BASELINE_RESOURCE_OWNER_MISMATCH');
    check(op ? savedState(current, base, journal.desired[key]) || !op.completed && isDeepStrictEqual(current, base.variant) : isDeepStrictEqual(current, base.variant), 'UNRELATED_OR_CONCURRENT_DRAFT_CHANGE');
  }
  for (const { site, locale, kind, key } of items) {
    const base = baseline.snapshots[key], path = route(site, locale, kind);
    if (journal.operations[`save:${key}`]?.completed) continue;
    const result = await operation(site, journal, key, 'save', path, () => ({ expectedVersion: base.variant.version, content: journal.desired[key] }));
    check(savedState(result.draft, base, journal.desired[key]), 'SAVED_DRAFT_RECEIPT_CHANGED');
  }
  journal.phase = 'saved'; await store(journal);
  console.info(JSON.stringify({ status: 'PASS', phase: 'saved', drafts: 8, published: 0, credentialsPrinted: false }));
}
async function verifyDrafts(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.phase === 'saved' && journal.baselineIssues, 'VERIFY_PHASE_CHANGED');
  for (const { site, locale, kind, key } of ordered(sites)) {
    const preview = await site.http.get<M4Preview>(route(site, locale, kind) + '/preview');
    check(savedState(preview.draft, baseline.snapshots[key], journal.desired[key]), 'PREVIEW_DRAFT_CHANGED');
    check(isDeepStrictEqual(preview.issues, journal.baselineIssues[key]), 'PREVIEW_ISSUES_CHANGED');
    if (kind === 'home') {
      const configKey = recordKey(site, locale, 'config');
      check(preview.config && isDeepStrictEqual(preview.config.content, journal.desired[configKey]), 'PREVIEW_CONFIG_STYLE_MISMATCH');
      const expectedSlides = carousel(journal.desired[key] as BuilderContent).slides;
      const resolved = preview.closure?.sections.find(section => section.section.type === 'hero_carousel')?.slides;
      check(resolved && resolved.length === expectedSlides.length && resolved.every((slide, index) => slide.title === expectedSlides[index].title && slide.highlight === expectedSlides[index].highlight), 'PREVIEW_HIGHLIGHTS_MISMATCH');
    }
  }
  journal.phase = 'verified'; await store(journal);
  console.info(JSON.stringify({ status: 'PASS', phase: 'verified', previews: 8, issuesUnchanged: true, publicationWrites: 0, credentialsPrinted: false }));
}
async function publish(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.phase === 'verified' && journal.publicBaseline, 'PUBLICATION_REQUIRES_VERIFIED_PREVIEW');
  const items = [...ordered(sites).filter(item => item.kind === 'home'), ...ordered(sites).filter(item => item.kind === 'config')];
  for (const { site, locale, kind, key } of items) {
    const current = await currentVariant(site, locale, kind), base = baseline.snapshots[key], op = journal.operations[`publish:${key}`];
    check(op ? publishedState(current, base, journal.desired[key]) || !op.completed && savedState(current, base, journal.desired[key]) : savedState(current, base, journal.desired[key]), 'UNRELATED_OR_CONCURRENT_PUBLICATION_CHANGE');
  }
  for (const { site, locale, kind, key } of items) {
    const base = baseline.snapshots[key], path = route(site, locale, kind);
    if (journal.operations[`publish:${key}`]?.completed) continue;
    const current = await currentVariant(site, locale, kind);
    check(savedState(current, base, journal.desired[key]) || publishedState(current, base, journal.desired[key]), 'PUBLICATION_HEAD_CHANGED');
    const configKey = recordKey(site, locale, 'config');
    const config = kind === 'home' ? await currentVariant(site, locale, 'config') : null;
    const pin = kind === 'home' ? fixedConfigPin(config!, baseline.snapshots[configKey]) : null;
    const result = await operation(site, journal, key, 'publish', path + '/publish', () => ({ expectedVersion: current.version, expectedPublicationVersion: base.variant.publicationVersion, expectedPublicationRevision: base.variant.publicationRevision, expectedConfigPublicationId: pin }));
    check(publishedState(result.draft, base, journal.desired[key]), 'PUBLICATION_RECEIPT_CHANGED');
  }
  await postPublishReadback(sites, baseline, journal);
  journal.phase = 'published'; await store(journal);
  console.info(JSON.stringify({ status: 'PASS', phase: 'published', publications: 8, publicReadbacks: 8, homeBeforeConfig: true, credentialsPrinted: false }));
}
export function fixedConfigPin(current: M4Variant, baseline: Snapshot): string {
  const old = baseline.variant;
  check(current.tenantId === baseline.tenantId && current.id === old.id && current.kind === 'config' && current.locale === old.locale && current.activePublication && !!old.publicationId && current.publicationId === old.publicationId && current.publicationVersion === old.publicationVersion && current.publicationRevision === old.publicationRevision, 'CONFIG_PUBLICATION_PIN_CHANGED');
  return old.publicationId;
}
export function expectedPublicContent(key: Key, baseline: Snapshot, publicContent: BuilderContent | SitePresentation): BuilderContent | SitePresentation {
  check(hash(publicContent) === baseline.publicContentHash, 'PUBLIC_BASELINE_HASH_CHANGED');
  return desiredHeroContent(key, { ...baseline.variant, content: publicContent });
}
export function resolvedSlidesMatch(resolved: { id: string; title: string; text: string }[] | undefined, expected: HeroCarouselSlide[]): boolean {
  return !!resolved && resolved.length === expected.length && resolved.every((slide, index) => slide.id === expected[index].id && slide.title === expected[index].title && slide.text === expected[index].text);
}
async function postPublishReadback(sites: Site[], baseline: Baseline, journal: Journal) {
  check(journal.publicBaseline, 'PUBLIC_BASELINE_MISSING');
  for (const { site, locale, kind, key } of ordered(sites)) {
    const current = await currentVariant(site, locale, kind), base = baseline.snapshots[key];
    check(publishedState(current, base, journal.desired[key]), 'POST_PUBLICATION_PRIVATE_HEAD_CHANGED');
    const expected = expectedPublicContent(key, base, journal.publicBaseline[key]);
    if (kind === 'config') {
      const publicConfig = await site.http.get<M4PublicConfig>(M4_ROUTES.publicConfig(site.slug, locale));
      check(publicConfig.locale === locale && publicConfig.publicationId === current.publicationId && isDeepStrictEqual(publicConfig.content, expected), 'POST_PUBLIC_CONFIG_MISMATCH');
      continue;
    }
    const resolution = await site.http.get<M4Resolution>(M4_ROUTES.publicPage(site.slug, locale, 'home', site.homeSlug));
    check(resolution.resolution === 'page' && resolution.actualLocale === locale && resolution.page.id === site.homeId && resolution.page.publicationId === current.publicationId && new URL(resolution.page.canonicalUrl).pathname === m4PublicPath(site.slug, locale, 'home'), 'POST_PUBLIC_HOME_HEAD_MISMATCH');
    const config = await currentVariant(site, locale, 'config');
    check(resolution.page.configPublicationId === config.publicationId && resolution.page.config?.publicationId === config.publicationId && resolution.page.config.content.signature?.heroTypography === (site.key === 'dental-go-plus' ? 'warm_editorial' : 'rose_editorial'), 'POST_PUBLIC_HOME_CONFIG_MISMATCH');
    check(isDeepStrictEqual(resolution.page.content, expected), 'POST_PUBLIC_HOME_CONTENT_MISMATCH');
    const expectedSlides = carousel(expected as BuilderContent).slides;
    const visibleSlides = resolution.page.sections.find(section => section.section.type === 'hero_carousel')?.slides;
    // 0060 project_core's resolved slides omit highlight; the complete page.content
    // equality above checks the saved phrase that the website parser reconstructs.
    check(resolvedSlidesMatch(visibleSlides, expectedSlides), 'POST_PUBLIC_HERO_PROJECTION_MISMATCH');
  }
}
async function main() {
  const phase = process.argv.slice(2).join(' ');
  check(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && ['--preflight', '--baseline-preview', '--capture-public-baseline', '--save', '--verify', '--publish'].includes(phase), 'EXPLICIT_LOCAL_HERO_PHASE_REQUIRED');
  await locked(async () => {
    const sites = await siteContexts(); for (const site of sites) await site.http.login();
    if (phase === '--preflight') return preflight(sites);
    const { baseline, journal } = await plan();
    if (phase === '--baseline-preview') return baselinePreviews(sites, baseline, journal);
    if (phase === '--capture-public-baseline') return capturePublicBaseline(sites, baseline, journal);
    if (phase === '--save') return saveDrafts(sites, baseline, journal);
    if (phase === '--verify') return verifyDrafts(sites, baseline, journal);
    return publish(sites, baseline, journal);
  });
}
if (import.meta.main) void main().catch(error => { console.error(error instanceof Error ? error.message : 'HERO_OPERATOR_FAILED'); process.exitCode = 1; });
