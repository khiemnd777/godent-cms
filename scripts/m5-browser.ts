/** New M5 fixtures only. Execute through the coordinator's approved local browser scope.
 * No bootstrap, API shortcuts, counter reset, worker dispatch or old fixture enrollment.
 * Business exports and diagnostic details stay in private .local files; public evidence
 * contains no credentials or payloads. Known credential values are redacted in errors.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { m4PublicPath, type M4Locale } from '../apps/api/src/contracts/m4';
import type { M5ExportManifest } from '../apps/api/src/contracts/m5-platform';
import { readM5Fixtures, type M5Identity } from './m5-fixtures';
import { readM5Demo } from './m5-demo';

const ADMIN = 'http://127.0.0.1:5891', GODENT = 'http://localhost:5892';
const WIDTHS = [1440, 390, 320] as const;
const CASE_IDS = [
  'a1_password_login',
  ...WIDTHS.map(width => `domains_geometry_${width}`),
  ...WIDTHS.map(width => `data_geometry_${width}`),
  'custom_home_vi', 'custom_home_en', 'custom_page_vi', 'custom_page_en',
  'custom_service_vi', 'custom_service_en', 'custom_navigation_click',
  'godent_direct_301_arrival', 'missing_en_direct_302_vi',
  'custom_service_consultation', 'shared_cms_lead_note', 'tenant_zip_active',
  'platform_password_login_monitor', 'platform_suspend', 'suspended_private_editor',
  'suspended_signed_media', 'suspended_zip', 'platform_reactivate',
  'reactivated_controls_publication', 'primary_reverify_outage',
  'primary_verify_local_recovery', 'return_godent_fresh_visitor',
  'restore_original_custom_primary', 'browser_page_errors',
] as const;

type Facts = Record<string, string | number | boolean | string[] | number[]>;
type PriorEvidence = { results: string; runId: string; caseId: string; sourceSha256: string };
type CaseResult = { id: string; status: 'PASS' | 'REUSED' | 'FAIL' | 'NOT_RUN'; startedAt?: string; durationMs?: number; errorName?: string; reason?: string; facts?: Facts; priorEvidence?: PriorEvidence; privateDiagnostic?: string };
type RecoveryResult = { action: string; status: 'PASS' | 'FAIL' | 'NOT_NEEDED'; errorName?: string };
type PageIdentity = { publication: string; config: string };
type PriorRun = { schemaVersion: number; owner: string; runId: string; fixtureRun: string; demoRun: string; sourceSha256: string; status: string; plannedCases: number; cases: CaseResult[]; recoveries: RecoveryResult[]; browserEvents: { kind: string }[] };
type Resume = { runId: string; path: string; sha256: string; sourceSha256: string; prefix: number; baseline: PageIdentity };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const errorName = (error: unknown) => error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,60}$/.test(error.name) ? error.name : 'RedactedError';
const panel = (page: Page, heading: string) => page.locator('section.panel').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });

async function ownedPrivateFile(path: string) {
  const stat = await lstat(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.mode & 0o777, 0o600);
  assert.equal(stat.uid, process.getuid?.());
}

async function readResume(fixtureRun: string, demoRun: string): Promise<Resume | null> {
  const flags = process.argv.filter(argument => argument.startsWith('--resume-from'));
  assert.ok(flags.length <= 1);
  if (!flags.length) return null;
  const runId = flags[0].slice('--resume-from='.length);
  assert.equal(flags[0], `--resume-from=${runId}`); assert.match(runId, UUID);
  const directory = `docs/evidence/m5/ui/${runId}`, path = `${directory}/results.json`;
  const stat = await lstat(directory);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink()); assert.equal(stat.mode & 0o777, 0o700); assert.equal(stat.uid, process.getuid?.());
  await ownedPrivateFile(path);
  const bytes = await readFile(path); assert.ok(bytes.length < 1024 * 1024);
  const prior = JSON.parse(bytes.toString()) as PriorRun;
  assert.equal(prior.schemaVersion, 1); assert.equal(prior.owner, 'GCMS-M5-UI-v1'); assert.equal(prior.runId, runId);
  assert.equal(prior.fixtureRun, fixtureRun); assert.equal(prior.demoRun, demoRun); assert.equal(prior.status, 'FAIL');
  assert.match(prior.sourceSha256, /^[0-9a-f]{64}$/); assert.equal(prior.plannedCases, CASE_IDS.length);
  assert.deepEqual(prior.cases.map(item => item.id), [...CASE_IDS]);
  const prefix = prior.cases.findIndex(item => item.status !== 'PASS');
  // This recovery is bounded to the observed first platform failure. It cannot
  // silently replay a consultation or a previously attempted lifecycle/domain command.
  assert.equal(prefix, CASE_IDS.indexOf('platform_password_login_monitor'));
  assert.ok(prior.cases.slice(0, prefix).every(item => item.status === 'PASS' && !item.priorEvidence));
  assert.equal(prior.cases[prefix].status, 'FAIL');
  assert.ok(prior.cases.slice(prefix + 1).every(item => item.status === 'NOT_RUN'));
  assert.deepEqual(prior.recoveries, [{ action: 'restore_active_tenant', status: 'NOT_NEEDED' }, { action: 'restore_original_custom_primary', status: 'NOT_NEEDED' }]);
  assert.ok(Array.isArray(prior.browserEvents) && prior.browserEvents.every(event => event.kind === 'console-error'));
  const facts = prior.cases.find(item => item.id === 'custom_service_vi')!.facts;
  assert.ok(facts && typeof facts.publication === 'string' && typeof facts.configPublication === 'string');
  assert.match(facts.publication, UUID); assert.match(facts.configPublication, UUID);
  return { runId, path, sha256: createHash('sha256').update(bytes).digest('hex'), sourceSha256: prior.sourceSha256, prefix, baseline: { publication: facts.publication, config: facts.configPublication } };
}

/** Inspect the actual stored ZIP directory and each entry CRC, including the final manifest.
 * The current backend uses ZIP32, method 0 and signed data descriptors. No extraction occurs.
 */
function inspectZip(bytes: Buffer, tenantId: string, includeMedia: boolean) {
  assert.ok(bytes.length > 22 && bytes.length < 64 * 1024 * 1024);
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 4), 0);
  assert.equal(bytes.readUInt16LE(end + 6), 0);
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10), directorySize = bytes.readUInt32LE(end + 12), directoryStart = bytes.readUInt32LE(end + 16);
  assert.equal(count, bytes.readUInt16LE(end + 8));
  assert.ok(count > 2 && count < 65535);
  assert.equal(directoryStart + directorySize, end);
  const table = Array.from({ length: 256 }, (_, index) => { let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
  const entries = new Map<string, Buffer>(); let offset = directoryStart, nextLocal = 0;
  for (let index = 0; index < count; index++) {
    assert.ok(offset + 46 <= end);
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), crc = bytes.readUInt32LE(offset + 16), size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    assert.equal(flags, 0x0808); assert.equal(method, 0); assert.equal(bytes.readUInt32LE(offset + 20), size); assert.equal(local, nextLocal);
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);
    assert.match(name, /^[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9]+)?$/);
    assert.ok(!name.startsWith('/') && !name.split('/').some(part => !part || part === '.' || part === '..') && !entries.has(name));
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    assert.equal(bytes.readUInt16LE(local + 6), flags); assert.equal(bytes.readUInt16LE(local + 8), method);
    const localNameLength = bytes.readUInt16LE(local + 26), localExtraLength = bytes.readUInt16LE(local + 28), start = local + 30 + localNameLength + localExtraLength;
    assert.equal(bytes.toString('utf8', local + 30, local + 30 + localNameLength), name);
    assert.ok(start + size + 16 <= directoryStart);
    const body = bytes.subarray(start, start + size); let actualCrc = 0xffffffff;
    for (const byte of body) actualCrc = table[(actualCrc ^ byte) & 255] ^ (actualCrc >>> 8);
    assert.equal((actualCrc ^ 0xffffffff) >>> 0, crc);
    assert.equal(bytes.readUInt32LE(start + size), 0x08074b50);
    assert.equal(bytes.readUInt32LE(start + size + 4), crc);
    assert.equal(bytes.readUInt32LE(start + size + 8), size);
    assert.equal(bytes.readUInt32LE(start + size + 12), size);
    entries.set(name, body); nextLocal = start + size + 16;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(nextLocal, directoryStart); assert.equal(offset, end);
  const info = JSON.parse(entries.get('export-info.json')!.toString()) as { tenantId: string; complete: boolean; exportId: string };
  const manifest = JSON.parse(entries.get('manifest.json')!.toString()) as M5ExportManifest;
  assert.equal(info.tenantId, tenantId); assert.equal(info.complete, false); assert.equal(info.exportId, manifest.exportId);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.tenantId, tenantId); assert.equal(manifest.complete, true);
  assert.equal(manifest.restoreBackup, false); assert.equal(manifest.includeMedia, includeMedia);
  assert.equal(manifest.consistency, 'bounded-current-authorized-batches');
  assert.ok(Number.isFinite(Date.parse(manifest.completedAt)) && Date.parse(manifest.completedAt) >= Date.parse(manifest.startedAt));
  assert.ok(manifest.datasets.length > 0);
  for (const dataset of manifest.datasets) {
    const body = entries.get(`data/${dataset.name}.jsonl`); assert.ok(body);
    const lines = body.toString().split('\n').filter(Boolean); assert.equal(lines.length, dataset.records);
    for (const line of lines) JSON.parse(line);
  }
  if (includeMedia) { assert.ok(manifest.media.included > 0); assert.ok([...entries.keys()].some(name => name.startsWith('media/'))); }
  return { bytes: bytes.length, zipEntries: count, datasets: manifest.datasets.length, includedMedia: manifest.media.included, manifestComplete: true, restoreBackup: false, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function main() {
  assert.equal(Bun.version, '1.4.3');
  assert.ok(process.argv.includes('--local-m5') && process.argv.includes('--synthetic-fixtures'));
  assert.equal(process.cwd(), resolve(import.meta.dir, '..'));
  await ownedPrivateFile('.local/m5-demo.json');
  const fixtures = await readM5Fixtures(), demo = await readM5Demo();
  assert.equal(fixtures.status, 'complete'); assert.equal(demo.status, 'complete');
  assert.deepEqual(fixtures.tenants.map(item => item.label).sort(), ['A', 'B', 'Deletion']);
  assert.equal(new Set(fixtures.tenants.map(item => item.id)).size, 3);
  const tenant = fixtures.tenants.find(item => item.label === 'A')!, a1 = fixtures.identities.find(item => item.label === 'A1')!, platformIdentity = fixtures.identities.find(item => item.label === 'PlatformOnly')!;
  assert.equal(demo.tenantId, tenant.id); assert.equal(demo.tenantSlug, tenant.slug);
  assert.ok(a1 && platformIdentity && demo.asset.id && demo.asset.revision);
  assert.deepEqual(demo.entries.map(item => item.key).sort(), ['home', 'page', 'service', 'viOnly']);
  for (const entry of demo.entries) assert.deepEqual(entry.locales, entry.key === 'viOnly' ? ['vi'] : ['vi', 'en']);
  const resume = await readResume(fixtures.runId, demo.runId);
  const host = `${tenant.slug}.localhost`, custom = `http://${host}:5892`, runId = randomUUID();
  const evidence = `docs/evidence/m5/ui/${runId}`, privateDirectory = `.local/m5-browser-${runId}`;
  await mkdir('docs/evidence/m5/ui', { recursive: true });
  await mkdir(evidence, { mode: 0o700 }); await mkdir(privateDirectory, { mode: 0o700 });
  const cases: CaseResult[] = CASE_IDS.map(id => ({ id, status: 'NOT_RUN', reason: 'Earlier prerequisite has not completed.' }));
  if (resume) for (const item of cases.slice(0, resume.prefix)) {
    item.status = 'REUSED'; item.reason = 'Verified in the linked prior run; not executed again.';
    item.priorEvidence = { results: resume.path, runId: resume.runId, caseId: item.id, sourceSha256: resume.sourceSha256 };
  }
  const recoveries: RecoveryResult[] = [], browserEvents: { case: string; kind: 'console-error' | 'pageerror'; name: string }[] = [];
  const diagnosticWriteErrors: { case: string; errorName: string }[] = [];
  const resumeGuards: { status: 'PASS' | 'FAIL' | 'NOT_RUN'; facts?: Facts } = { status: 'NOT_RUN' };
  const sourceSha256 = createHash('sha256').update(await readFile(import.meta.path)).digest('hex');
  let currentCase = 'preflight', currentStep = 'preflight', lastPage: Page | undefined, browser: Browser | undefined, fatalErrorName: string | undefined;
  let suspensionAttempted = false, domainAttempted = false;
  let tenantPage: Page | undefined, platformPage: Page | undefined;
  const contexts: BrowserContext[] = [];
  let baseline: PageIdentity | undefined;

  function ownedPage(page: Page) {
    try { const url = new URL(page.url()); return url.origin === ADMIN && (url.pathname.startsWith('/cms') || url.pathname === '/platform/limits') || url.origin === custom || url.origin === GODENT && (url.pathname === `/${tenant.slug}` || url.pathname.startsWith(`/${tenant.slug}/`)); }
    catch { return false; }
  }
  async function screenshot(page: Page, name: string) {
    if (page.isClosed() || !ownedPage(page)) return;
    // Mask all editable values and account controls, including failure states with passwords.
    await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true, animations: 'disabled', mask: [page.locator('input,textarea,[contenteditable="true"],.account-menu,.account-button,[autocomplete="email"]')] });
    await chmod(`${evidence}/${name}.png`, 0o600);
  }
  async function persist() {
    const failed = !!fatalErrorName || cases.some(item => item.status === 'FAIL') || recoveries.some(item => item.status === 'FAIL');
    const allPassed = cases.every(item => item.status === 'PASS' || item.status === 'REUSED') && (!resume || resumeGuards.status === 'PASS');
    await writeFile(`${evidence}/results.json`, JSON.stringify({ schemaVersion: 1, owner: 'GCMS-M5-UI-v1', runId, fixtureRun: fixtures.runId, demoRun: demo.runId, status: failed ? 'FAIL' : allPassed ? 'PASS' : 'NOT_RUN', fatalErrorName, plannedCases: cases.length, completedCases: cases.filter(item => item.status !== 'NOT_RUN').length, newPass: cases.filter(item => item.status === 'PASS').length, reused: cases.filter(item => item.status === 'REUSED').length, sourceSha256, resume: resume ? { priorEvidence: resume.path, priorResultsSha256: resume.sha256, priorSourceSha256: resume.sourceSha256, firstCase: CASE_IDS[resume.prefix], guards: resumeGuards } : null, cases, recoveries, browserEvents, diagnosticWriteErrors, limits: ['Local synthetic UAT only; no live DNS or TLS verification.', 'REUSED cases link prior PASS evidence and are not fresh execution.', 'Exports are business data, not restore backups; private ZIP files remain in .local.', 'Screenshots mask editable values; public console/page errors retain names/types only; diagnostic details are private with known credentials redacted.', 'No assertion about previously cached 301 recovery; return-to-Godent uses a fresh visitor context.', 'No new tenant or deletion execution is performed.'] }, null, 2) + '\n', { mode: 0o600 });
  }
  async function diagnostic(id: string, error: unknown) {
    const secrets = fixtures.identities.flatMap(identity => [identity.password, identity.email]).filter(Boolean).sort((left, right) => right.length - left.length);
    const redact = (value: string) => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED_CREDENTIAL]').split(encodeURIComponent(secret)).join('[REDACTED_CREDENTIAL]'), value);
    const path = `${privateDirectory}/${id}-error.json`;
    try {
      await writeFile(path, JSON.stringify({ case: id, step: currentStep, recordedAt: new Date().toISOString(), errorName: errorName(error), message: redact(error instanceof Error ? error.message : typeof error === 'string' ? error : 'Non-Error failure'), stack: error instanceof Error && error.stack ? redact(error.stack) : null }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      await ownedPrivateFile(path); return path;
    } catch (failure) { diagnosticWriteErrors.push({ case: id, errorName: errorName(failure) }); return undefined; }
  }
  async function runCase(id: string, action: () => Promise<Facts | void>) {
    const result = cases.find(item => item.id === id); assert.ok(result);
    if (result.status === 'REUSED') { console.info(JSON.stringify({ case: id, status: 'REUSED', priorEvidence: result.priorEvidence?.results })); return; }
    assert.equal(result.status, 'NOT_RUN');
    currentCase = id; currentStep = id; result.startedAt = new Date().toISOString(); const started = Date.now(); delete result.reason;
    console.info(JSON.stringify({ case: id, status: 'RUNNING' }));
    try { const facts = await action(); result.status = 'PASS'; if (facts) result.facts = facts; }
    catch (error) { result.status = 'FAIL'; result.errorName = errorName(error); result.privateDiagnostic = await diagnostic(id, error); if (lastPage) await screenshot(lastPage, `${id}-failure`).catch(() => {}); throw error; }
    finally { result.durationMs = Date.now() - started; await persist(); console.info(JSON.stringify({ case: id, status: result.status })); }
  }
  async function newPage() {
    assert.ok(browser);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce', acceptDownloads: true }); contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    page.on('console', message => { if (message.type() === 'error') browserEvents.push({ case: currentCase, kind: 'console-error', name: 'error' }); });
    page.on('pageerror', error => browserEvents.push({ case: currentCase, kind: 'pageerror', name: errorName(error) }));
    return page;
  }
  async function goto(page: Page, url: string) { lastPage = page; return page.goto(url, { waitUntil: 'domcontentloaded' }); }
  async function login(page: Page, identity: M5Identity, destination: '/cms' | '/platform') {
    await goto(page, `${ADMIN}/login`);
    await page.getByLabel('Email', { exact: true }).fill(identity.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(identity.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(url => url.origin === ADMIN && url.pathname === destination);
    await expect(page.locator('main')).toBeVisible();
  }
  async function reauth(page: Page, identity: M5Identity, heading: string) {
    lastPage = page; const section = panel(page, heading); currentStep = 'reauth_unique_panel'; await expect(section).toHaveCount(1);
    currentStep = 'reauth_password';
    await section.getByLabel('Mật khẩu', { exact: true }).fill(identity.password);
    currentStep = 'reauth_submit';
    await section.getByRole('button', { name: 'Xác thực lại', exact: true }).click();
    currentStep = 'reauth_status';
    await expect(section.getByRole('status')).toContainText('Đã xác thực lại.');
    currentStep = 'reauth_password_cleared';
    await expect(section.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  }
  async function domains(page: Page) {
    await goto(page, `${ADMIN}/cms/settings/domains?tenant=${tenant.id}`);
    await expect(page.getByRole('heading', { name: 'Tên miền & địa chỉ chính', exact: true })).toBeVisible();
    await expect(binding(page)).toBeVisible();
  }
  function binding(page: Page) { return page.locator('article.m5-binding').filter({ has: page.getByRole('heading', { name: host, exact: true }) }); }
  async function primaryCustom(page: Page) {
    await expect(panel(page, 'Địa chỉ chính').locator('.identifier')).toHaveText(`${custom}/`);
    await expect(binding(page)).toContainText('Địa chỉ chính hiện tại');
  }
  async function domainConfirmation(page: Page, button: string, reason?: string) {
    const section = panel(page, 'Xác nhận thay đổi tên miền'); await expect(section).toContainText(tenant.name);
    if (reason) await section.getByLabel('Lý do', { exact: true }).fill(reason);
    await section.getByRole('checkbox', { name: 'Tôi xác nhận đúng nha khoa, tên miền và tác động của thao tác.', exact: true }).check();
    await section.getByRole('button', { name: button, exact: true }).click();
    await expect(section).toHaveCount(0);
  }
  async function geometry(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready);
    const metric = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary')).filter(node => { const box = node.getBoundingClientRect(), style = getComputedStyle(node); return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; });
      const outside = controls.filter(node => { const box = node.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; });
      return { viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, visibleControls: controls.length, outsideControls: outside.length };
    });
    await screenshot(page, name);
    assert.ok(metric.documentWidth <= metric.viewportWidth + 1); assert.equal(metric.outsideControls, 0); assert.ok(metric.visibleControls > 0);
    return metric;
  }
  const entry = (key: 'home' | 'page' | 'viOnly' | 'service') => demo.entries.find(item => item.key === key)!;
  function path(key: 'home' | 'page' | 'viOnly' | 'service', locale: M4Locale) { const item = entry(key); return m4PublicPath(tenant.slug, locale, item.kind, item.slug); }
  function customUrl(key: 'home' | 'page' | 'viOnly' | 'service', locale: M4Locale) { return custom + (path(key, locale).slice(tenant.slug.length + 1) || '/'); }
  async function healthyImages(page: Page) {
    const images = page.locator('.builder-site img'); assert.ok(await images.count() > 0);
    await images.evaluateAll(nodes => nodes.forEach(node => { (node as HTMLImageElement).loading = 'eager'; }));
    await expect.poll(() => images.evaluateAll(nodes => nodes.filter(node => { const image = node as HTMLImageElement; return !image.complete || image.naturalWidth === 0; }).length), { timeout: 20000 }).toBe(0);
    return images.count();
  }
  async function publicPage(page: Page, url: string, locale: M4Locale, canonical: string, identity?: PageIdentity) {
    const response = await goto(page, url); assert.equal(response?.status(), 200); assert.equal(page.url(), url);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    const shell = page.locator('.builder-site'); await expect(shell).toBeVisible();
    const current = { publication: await shell.getAttribute('data-publication') ?? '', config: await shell.getAttribute('data-config-publication') ?? '' };
    assert.ok(current.publication && current.config); if (identity) assert.deepEqual(current, identity);
    const images = await healthyImages(page);
    return { current, images };
  }
  async function navigation(page: Page, target: string, locale: M4Locale) {
    const menu = page.locator('details.builder-menu');
    if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
    const label = locale === 'vi' ? 'Giới thiệu' : 'About', link = menu.getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', target);
    await link.click(); await page.waitForURL(target); await expect(page.locator('.builder-site')).toBeVisible();
  }
  async function redirectArrival(page: Page, source: string, destination: string, status: number) {
    const response = await goto(page, source); assert.equal(response?.status(), 200); assert.equal(page.url(), destination);
    const previous = response!.request().redirectedFrom(); assert.ok(previous); assert.equal(previous.url(), source); assert.equal(previous.redirectedFrom(), null);
    const redirect = await previous.response(); assert.equal(redirect?.status(), status); assert.equal(redirect?.headers().location, destination);
  }
  async function exportZip(page: Page, id: string) {
    await goto(page, `${ADMIN}/cms/settings/data?tenant=${tenant.id}`);
    const section = panel(page, 'Xuất dữ liệu'); await expect(section).toBeVisible();
    await section.getByRole('checkbox', { name: 'Kèm các tệp ảnh được phép tải', exact: true }).check();
    const link = section.getByRole('link', { name: 'Tải ZIP dữ liệu', exact: true }); await expect(link).toBeVisible();
    const pending = page.waitForEvent('download', { timeout: 30000 }); await link.click(); const download = await pending;
    const filename = `${privateDirectory}/${id}.zip`; await download.saveAs(filename); await chmod(filename, 0o600);
    assert.equal(await download.failure(), null); await ownedPrivateFile(filename);
    const facts = inspectZip(await readFile(filename), tenant.id, true); await download.delete();
    return facts;
  }
  async function platformOperations(page: Page) {
    await goto(page, `${ADMIN}/platform/limits?tenant=${tenant.id}`);
    currentStep = 'platform_heading';
    await expect(page.getByRole('heading', { name: 'Hạn mức & vòng đời nha khoa', exact: true })).toBeVisible();
    currentStep = 'platform_tenant_identity';
    await expect(page.getByRole('combobox', { name: /^Chọn nha khoa/ })).toHaveValue(tenant.id);
    currentStep = 'platform_quota_identity';
    await expect(panel(page, 'Hạn mức & sử dụng')).toContainText(tenant.id);
  }
  async function lifecycle(page: Page, action: 'suspend' | 'reactivate') {
    await reauth(page, platformIdentity, 'Xác thực thao tác nhạy cảm');
    const section = panel(page, 'Vòng đời nha khoa');
    await expect(section.locator('.panel-head .tag')).toHaveText(action === 'suspend' ? 'Đang hoạt động' : 'Tạm dừng');
    await section.getByLabel('Lý do', { exact: true }).fill(`M5 owned browser ${runId}: ${action}`);
    await section.getByRole('checkbox', { name: 'Tôi xác nhận đúng nha khoa và tác động của thay đổi.', exact: true }).check();
    await section.getByRole('button', { name: action === 'suspend' ? 'Xác nhận tạm dừng' : 'Xác nhận hoạt động lại', exact: true }).click();
    await expect(section.locator('.panel-head .tag')).toHaveText(action === 'suspend' ? 'Tạm dừng' : 'Đang hoạt động');
  }
  async function editor(page: Page, suspended: boolean) {
    await goto(page, `${ADMIN}/cms/variants/service/${entry('service').id}/vi?tenant=${tenant.id}`);
    const title = page.getByLabel('Dịch vụ · Tên / tiêu đề *', { exact: true });
    await expect(title).toHaveValue('M5 service minh họa');
    if (suspended) { await expect(title).toBeDisabled(); await expect(page.getByRole('button', { name: 'Lưu bản nháp', exact: true })).toBeDisabled(); }
    else { await expect(title).toBeEnabled(); const value = await title.inputValue(); await title.fill(`${value} draft check`); await expect(page.getByRole('button', { name: 'Lưu bản nháp', exact: true })).toBeEnabled(); await title.fill(value); await expect(page.getByRole('button', { name: 'Lưu bản nháp', exact: true })).toBeDisabled(); }
  }
  async function restoreCustom(page: Page) {
    await domains(page); await reauth(page, a1, 'Xác minh tên miền trong local');
    const verify = binding(page).getByRole('button', { name: 'Yêu cầu kiểm tra local', exact: true });
    if (await verify.isVisible()) { await verify.click(); await domainConfirmation(page, 'Xác nhận kiểm tra local'); }
    await expect(binding(page).getByText('Đang hoạt động', { exact: true })).toBeVisible();
    if (await binding(page).getByText('Địa chỉ chính hiện tại', { exact: true }).count() === 0) {
      await binding(page).getByRole('button', { name: 'Đặt làm địa chỉ chính', exact: true }).click();
      await domainConfirmation(page, 'Xác nhận đổi địa chỉ chính', `M5 owned browser ${runId}: restore original custom primary`);
    }
    await primaryCustom(page);
  }

  try {
    await persist();
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
    tenantPage = await newPage();
    if (resume) {
      currentCase = 'resume_guards'; currentStep = 'resume_fresh_a1_login';
      try {
        await login(tenantPage, a1, '/cms');
        currentStep = 'resume_active_tenant';
        await goto(tenantPage, `${ADMIN}/cms/settings/data?tenant=${tenant.id}`);
        await expect(panel(tenantPage, 'Trạng thái & hạn mức').locator('.panel-head .tag')).toHaveText('Đang hoạt động');
        currentStep = 'resume_custom_primary';
        await domains(tenantPage); await primaryCustom(tenantPage);
        await expect(panel(tenantPage, 'Địa chỉ chính')).toContainText('Đáp ứng điều kiện hiện tại');
        currentStep = 'resume_publication_config_image_baseline';
        const fresh = await newPage(), result = await publicPage(fresh, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'), resume.baseline);
        baseline = result.current;
        resumeGuards.status = 'PASS'; resumeGuards.facts = { freshA1PasswordLogin: true, currentTenantActive: true, currentCustomPrimary: true, currentPrimaryReady: true, publication: baseline.publication, configPublication: baseline.config, images: result.images, prefixCasesReused: resume.prefix, submissionRepeated: false };
        await persist();
      } catch (error) { resumeGuards.status = 'FAIL'; await diagnostic('resume_guards', error); throw error; }
    }
    await runCase('a1_password_login', async () => { await login(tenantPage!, a1, '/cms'); await domains(tenantPage!); await primaryCustom(tenantPage!); return { ordinaryPasswordLogin: true, originalCustomPrimary: true }; });
    for (const width of WIDTHS) await runCase(`domains_geometry_${width}`, async () => { await tenantPage!.setViewportSize({ width, height: width === 1440 ? 1080 : 844 }); await domains(tenantPage!); return geometry(tenantPage!, `domains-${width}`); });
    for (const width of WIDTHS) await runCase(`data_geometry_${width}`, async () => { await tenantPage!.setViewportSize({ width, height: width === 1440 ? 1080 : 844 }); await goto(tenantPage!, `${ADMIN}/cms/settings/data?tenant=${tenant.id}`); await expect(panel(tenantPage!, 'Xuất dữ liệu')).toBeVisible(); return geometry(tenantPage!, `data-${width}`); });
    await tenantPage.setViewportSize({ width: 1440, height: 1080 });
    const visitor = await newPage();
    for (const key of ['home', 'page', 'service'] as const) for (const locale of ['vi', 'en'] as const) await runCase(`custom_${key}_${locale}`, async () => {
      const result = await publicPage(visitor, customUrl(key, locale), locale, customUrl(key, locale));
      if (key === 'service' && locale === 'vi') baseline = result.current;
      await screenshot(visitor, `custom-${key}-${locale}`); return { images: result.images, publication: result.current.publication, configPublication: result.current.config };
    });
    await runCase('custom_navigation_click', async () => { await publicPage(visitor, customUrl('home', 'vi'), 'vi', customUrl('home', 'vi')); await navigation(visitor, customUrl('page', 'vi'), 'vi'); return { actualMenuClick: true }; });
    await runCase('godent_direct_301_arrival', async () => { const fresh = await newPage(); await redirectArrival(fresh, GODENT + path('service', 'en'), customUrl('service', 'en'), 301); await expect(fresh.locator('html')).toHaveAttribute('lang', 'en'); return { redirects: 1, status: 301, actualLocale: 'en' }; });
    await runCase('missing_en_direct_302_vi', async () => { const fresh = await newPage(); await redirectArrival(fresh, customUrl('viOnly', 'en'), customUrl('viOnly', 'vi'), 302); await expect(fresh.locator('html')).toHaveAttribute('lang', 'vi'); await expect(fresh.locator('link[rel="canonical"]')).toHaveAttribute('href', customUrl('viOnly', 'vi')); return { redirects: 1, status: 302, actualLocale: 'vi' }; });
    const leadName = `M5 browser ${runId.slice(0, 8)}`, note = `Synthetic M5 shared lead note ${runId}`;
    await runCase('custom_service_consultation', async () => {
      await publicPage(visitor, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'));
      const section = visitor.locator('.consultation');
      await section.getByLabel('Họ tên (không bắt buộc)', { exact: true }).fill(leadName);
      await section.getByLabel('Số điện thoại', { exact: true }).fill('0900111222');
      await section.getByLabel('Lời nhắn (không bắt buộc)', { exact: true }).fill('Synthetic local M5 verification. No patient information.');
      await section.locator('.consultation-consent input').check();
      await section.getByRole('button', { name: 'Gửi yêu cầu tư vấn', exact: true }).click();
      let captchaSolved = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        await expect.poll(async () => await section.getByRole('heading', { name: 'Đã tiếp nhận yêu cầu tư vấn', exact: true }).count() > 0 || await section.locator('form[aria-busy="false"]').count() > 0, { timeout: 20000 }).toBe(true);
        if (await section.getByRole('heading', { name: 'Đã tiếp nhận yêu cầu tư vấn', exact: true }).isVisible()) break;
        const challenge = section.locator('.consultation-verification label'); await expect(challenge).toBeVisible();
        const match = /([0-9]{1,2})\s*\+\s*([0-9]{1,2})\s*=\s*\?/.exec(await challenge.innerText()); assert.ok(match);
        await challenge.locator('input').fill(String(Number(match[1]) + Number(match[2]))); captchaSolved = true;
        await section.getByRole('button', { name: 'Thử lại cùng yêu cầu', exact: true }).click();
      }
      await expect(section.getByRole('heading', { name: 'Đã tiếp nhận yêu cầu tư vấn', exact: true })).toBeVisible();
      await screenshot(visitor, 'consultation-accepted'); return { accepted: true, captchaSolvedWhenRequested: captchaSolved, counterReset: false };
    });
    await runCase('shared_cms_lead_note', async () => {
      await goto(tenantPage!, `${ADMIN}/cms/leads?tenant=${tenant.id}`);
      await tenantPage!.getByRole('searchbox', { name: 'Tìm tên hoặc mã yêu cầu', exact: true }).fill(leadName);
      await tenantPage!.getByRole('button', { name: 'Áp dụng', exact: true }).click();
      await tenantPage!.getByRole('button', { name: `Mở yêu cầu ${leadName}`, exact: true }).click();
      const composer = tenantPage!.getByRole('region', { name: 'Thêm hoạt động', exact: true });
      await composer.getByLabel('Nội dung ghi chú', { exact: true }).fill(note);
      await composer.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
      await expect(tenantPage!.getByRole('region', { name: 'Lịch sử hoạt động', exact: true }).getByText(note, { exact: true })).toBeVisible();
      await screenshot(tenantPage!, 'shared-lead-note'); return { sameTenantSharedLead: true, noteInHistory: true };
    });
    await runCase('tenant_zip_active', () => exportZip(tenantPage!, 'active'));
    platformPage = await newPage();
    await runCase('platform_password_login_monitor', async () => {
      await login(platformPage!, platformIdentity, '/platform'); await platformOperations(platformPage!);
      await reauth(platformPage!, platformIdentity, 'Xác thực thao tác nhạy cảm');
      const section = panel(platformPage!, 'Hạn mức & sử dụng'), mode = section.getByRole('combobox', { name: /^Chế độ/ });
      const changed = await mode.inputValue() !== 'monitor';
      if (changed) {
        await mode.selectOption('monitor');
        await section.getByLabel('Lý do', { exact: true }).fill(`M5 owned browser ${runId}: explicit monitor`);
        await section.getByRole('checkbox', { name: 'Tôi xác nhận chế độ và các giới hạn, kể cả giá trị 0 nếu đã nhập.', exact: true }).check();
        await section.getByRole('button', { name: 'Xác nhận hạn mức', exact: true }).click();
      }
      await expect(section).toContainText('Theo dõi, chưa chặn tăng'); await expect(mode).toHaveValue('monitor');
      await screenshot(platformPage!, 'platform-monitor'); return { separateContext: true, monitorExplicit: true, changed };
    });
    await runCase('platform_suspend', async () => { suspensionAttempted = true; await lifecycle(platformPage!, 'suspend'); await screenshot(platformPage!, 'platform-suspended'); });
    await runCase('suspended_private_editor', async () => { await editor(tenantPage!, true); await screenshot(tenantPage!, 'suspended-editor'); return { currentPrivateContentReadable: true, draftSaveDisabled: true }; });
    await runCase('suspended_signed_media', async () => {
      await goto(tenantPage!, `${ADMIN}/cms/media?tenant=${tenant.id}`);
      await tenantPage!.getByRole('button').filter({ hasText: `Ảnh ${demo.asset.id!.slice(0, 8)}` }).click();
      const image = tenantPage!.getByRole('img', { name: 'Ảnh trong thư viện riêng tư', exact: true }); await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await expect(panel(tenantPage!, 'Tải ảnh lên').getByLabel(/^Ảnh JPEG, PNG hoặc WebP/)).toBeDisabled();
      await expect(tenantPage!.getByRole('button', { name: 'Thu hồi quyền truy cập', exact: true })).toBeEnabled();
      await screenshot(tenantPage!, 'suspended-private-image'); return { signedPrivateImageReadable: true, uploadDisabled: true, safetyWithdrawalAvailable: true };
    });
    await runCase('suspended_zip', () => exportZip(tenantPage!, 'suspended'));
    await runCase('platform_reactivate', async () => { await lifecycle(platformPage!, 'reactivate'); suspensionAttempted = false; });
    await runCase('reactivated_controls_publication', async () => {
      await editor(tenantPage!, false); const fresh = await newPage(); assert.ok(baseline);
      await publicPage(fresh, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'), baseline);
      return { controlsRecovered: true, unchangedPublication: true, unchangedConfigPublication: true };
    });
    await runCase('primary_reverify_outage', async () => {
      await domains(tenantPage!); await primaryCustom(tenantPage!); await reauth(tenantPage!, a1, 'Xác minh tên miền trong local');
      await binding(tenantPage!).getByRole('button', { name: 'Xác minh lại tên miền chính', exact: true }).click();
      domainAttempted = true; await domainConfirmation(tenantPage!, 'Xác nhận xác minh lại', `M5 owned browser ${runId}: reverify primary`);
      await primaryCustom(tenantPage!); await expect(binding(tenantPage!).getByRole('button', { name: 'Yêu cầu kiểm tra local', exact: true })).toBeEnabled();
      await expect(binding(tenantPage!)).toContainText('Địa chỉ chính được giữ nguyên.');
      // The unattested custom entry cannot resolve, so the proxy returns its exact 421 boundary.
      const fresh = await newPage(), response = await goto(fresh, customUrl('service', 'vi')); assert.equal(response?.status(), 421);
      await expect(fresh.locator('.builder-site')).toHaveCount(0); await screenshot(tenantPage!, 'pending-primary-recovery-action');
      return { primaryPointerPreserved: true, customDeliveryStatus: 421, customDeliveryDenied: true, verifyLocalActionAvailable: true };
    });
    await runCase('primary_verify_local_recovery', async () => {
      await reauth(tenantPage!, a1, 'Xác minh tên miền trong local');
      await binding(tenantPage!).getByRole('button', { name: 'Yêu cầu kiểm tra local', exact: true }).click(); await domainConfirmation(tenantPage!, 'Xác nhận kiểm tra local');
      await primaryCustom(tenantPage!); const fresh = await newPage(); assert.ok(baseline);
      await publicPage(fresh, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'), baseline);
      return { explicitLocalVerification: true, samePrimaryHost: true, unchangedPublication: true, realTlsVerified: false };
    });
    await runCase('return_godent_fresh_visitor', async () => {
      await reauth(tenantPage!, a1, 'Xác minh tên miền trong local');
      await panel(tenantPage!, 'Địa chỉ chính').getByRole('button', { name: 'Chuyển địa chỉ chính về Godent', exact: true }).click();
      await domainConfirmation(tenantPage!, 'Xác nhận trở về Godent', `M5 owned browser ${runId}: return Godent`);
      await expect(panel(tenantPage!, 'Địa chỉ chính').locator('.identifier')).toHaveText(`${GODENT}/${tenant.slug}`);
      const fresh = await newPage(); await publicPage(fresh, customUrl('home', 'vi'), 'vi', GODENT + path('home', 'vi'));
      await navigation(fresh, GODENT + path('page', 'vi'), 'vi'); await expect(fresh.locator('link[rel="canonical"]')).toHaveAttribute('href', GODENT + path('page', 'vi'));
      await screenshot(fresh, 'returned-godent-navigation'); return { oldCustomStatus: 200, canonicalGodent: true, absoluteNavigationClicked: true, freshVisitorContext: true, cached301RecoveryClaimed: false };
    });
    await runCase('restore_original_custom_primary', async () => {
      await restoreCustom(tenantPage!); const fresh = await newPage(); assert.ok(baseline);
      await publicPage(fresh, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'), baseline);
      await screenshot(tenantPage!, 'restored-custom-primary'); domainAttempted = false; return { originalCustomPrimaryRestored: true, unchangedPublication: true };
    });
    await runCase('browser_page_errors', async () => { const errors = browserEvents.filter(event => event.kind === 'pageerror'); assert.equal(errors.length, 0); return { uncaughtPageErrors: 0, consoleErrorEvents: browserEvents.filter(event => event.kind === 'console-error').length, consoleMessagesRetained: false }; });
  } catch (error) {
    fatalErrorName = errorName(error);
    if (!cases.find(item => item.id === currentCase)?.privateDiagnostic && currentCase !== 'resume_guards') await diagnostic(`fatal-${currentCase}`, error);
    throw error;
  } finally {
    // Read current authoritative UI state before any recovery. Never create a deletion,
    // publish content, reset fixtures, or retry an unknown command with another payload.
    currentCase = 'recovery';
    if (suspensionAttempted && platformPage) {
      try { await platformOperations(platformPage); const tag = panel(platformPage, 'Vòng đời nha khoa').locator('.panel-head .tag'); if (await tag.innerText() === 'Tạm dừng') await lifecycle(platformPage, 'reactivate'); await expect(tag).toHaveText('Đang hoạt động'); recoveries.push({ action: 'restore_active_tenant', status: 'PASS' }); }
      catch (error) { recoveries.push({ action: 'restore_active_tenant', status: 'FAIL', errorName: errorName(error) }); }
    } else recoveries.push({ action: 'restore_active_tenant', status: 'NOT_NEEDED' });
    if (domainAttempted && tenantPage) {
      try { await restoreCustom(tenantPage); const fresh = await newPage(); await publicPage(fresh, customUrl('service', 'vi'), 'vi', customUrl('service', 'vi'), baseline); recoveries.push({ action: 'restore_original_custom_primary', status: 'PASS' }); }
      catch (error) { recoveries.push({ action: 'restore_original_custom_primary', status: 'FAIL', errorName: errorName(error) }); }
    } else recoveries.push({ action: 'restore_original_custom_primary', status: 'NOT_NEEDED' });
    await persist();
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    const failed = !!fatalErrorName || cases.some(item => item.status !== 'PASS' && item.status !== 'REUSED') || recoveries.some(item => item.status === 'FAIL') || !!resume && resumeGuards.status !== 'PASS';
    console.info(JSON.stringify({ status: failed ? 'FAIL' : 'PASS', plannedCases: cases.length, newPass: cases.filter(item => item.status === 'PASS').length, reused: cases.filter(item => item.status === 'REUSED').length, failed: cases.filter(item => item.status === 'FAIL').length, notRun: cases.filter(item => item.status === 'NOT_RUN').length, evidence, detailsRedacted: true }));
    if (failed) process.exitCode = 1;
  }
}

if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'm5-browser', errorName: errorName(error), detailsRedacted: true })); process.exitCode = 1; });
