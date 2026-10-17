import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { M3_ROUTES, type ContentCommandResult, type DentalContent } from '../apps/api/src/contracts/m3';
import { M4_ROUTES, type BuilderContent, type M4CommandResult, type M4Content, type M4PublicSearch, type M4Resolution, type M4Variant } from '../apps/api/src/contracts/m4';
import { parseM4Content } from '../apps/api/src/contracts/m4-validation';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import type { LacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';

const OWNER = 'GCMS-LACVAN-SEARCH-PROOF-v1', JOURNAL = '.local/lacvan-search-proof.json', LOCK = '.local/lacvan-search-proof.lock';
const TEST = 'apps/api/test/lacvan-search-budget-integration.test.ts';
const KEYS = ['draft-create', 'case-legacy', 'case-adopt', 'case-grant', 'case-publish', 'wrapper-create', 'wrapper-publish', 'case-withdraw', 'cleanup-wrapper', 'cleanup-case'] as const;
type Key = typeof KEYS[number];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hex = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function canonical(v: unknown): string { if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => JSON.stringify(k) + ':' + canonical(value)).join(',') + '}'; return JSON.stringify(v); }
export const searchProofHash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
class ProofFailure extends Error { constructor(readonly code: string) { super(code); } }
function assert(v: unknown, code: string): asserts v { if (!v) throw new ProofFailure(code); }
type Reply = M4CommandResult | ContentCommandResult;
interface Resource { id: string; slug: string; title: string; content: M4Content | null; publicationId: string | null }
interface Command { id: string; path: string; method: 'POST' | 'PUT'; body: Record<string, unknown>; hash: string; attempted: boolean; done: boolean; reply: Reply | null }
interface Sample { label: string; status: number; milliseconds: number; items: number | null; continued: boolean | null }
interface Attempt { id: string; mode?: 'full' | 'http-only'; sqlReusedFrom?: string; startedAt: string; endedAt: string | null; privateLog: string | null; testSha256: string | null; sql: { status: 'NOT_RUN' | 'PASS' | 'FAIL'; exitCode: number | null; tests: number | null; assertions: number | null }; http: { status: 'NOT_RUN' | 'PASS' | 'FAIL'; samples: Sample[] }; cleanup: 'NOT_RUN' | 'PASS' | 'FAIL'; error: { stage: string; code: string } | null; summary: string | null }
export interface SearchProofJournal {
  owner: typeof OWNER; version: 1; fixtureRun: string; runId: string; tenantId: string; tenantSlug: 'lac-van'; actorId: string; generation: number;
  stage: string; status: 'planned' | 'prepared' | 'complete'; resources: { draft: Resource; case: Resource; wrapper: Resource };
  operationIds: Record<Key, string>; operations: Partial<Record<Key, Command>>; permissionId: string | null; attempts: Attempt[];
}
export function planSearchProof(f: LacVanFixtures): SearchProofJournal {
  const runId = randomUUID(), draftId = randomUUID(), caseId = randomUUID(), wrapperId = randomUUID(), owner = f.identities.find(i => i.label === 'Owner'); assert(owner, 'OWNER_REQUIRED');
  const ids = Object.fromEntries(KEYS.map(k => [k, randomUUID()])) as Record<Key, string>; ids['draft-create'] = draftId; ids['case-legacy'] = caseId; ids['wrapper-create'] = wrapperId;
  const j: SearchProofJournal = { owner: OWNER, version: 1, fixtureRun: f.runId, runId, tenantId: f.tenant.id, tenantSlug: 'lac-van', actorId: owner.userId, generation: 0, stage: 'plan-saved', status: 'planned', resources: { draft: { id: draftId, slug: `ghi-chu-${runId}`, title: `Ghi chú chưa công bố ${runId}`, content: null, publicationId: null }, case: { id: caseId, slug: `trao-doi-${runId}`, title: `Trao đổi riêng ${runId}`, content: null, publicationId: null }, wrapper: { id: wrapperId, slug: `khong-gian-doc-${runId}`, title: `Không gian đọc ${runId}`, content: null, publicationId: null } }, operationIds: ids, operations: {}, permissionId: null, attempts: [] };
  validateSearchProof(j, f); return j;
}
export function validateSearchProof(j: SearchProofJournal, f: LacVanFixtures) {
  assert(f.owner === 'GCMS-LACVAN-001-v1' && f.status === 'complete' && j.owner === OWNER && j.version === 1 && j.fixtureRun === f.runId && uuid(j.runId) && j.tenantId === f.tenant.id && j.tenantSlug === f.tenant.slug && j.tenantSlug === 'lac-van' && j.actorId === f.identities.find(i => i.label === 'Owner')?.userId, 'WRONG_PROOF_OWNER');
  assert(Number.isSafeInteger(j.generation) && j.generation >= 0 && ['planned', 'prepared', 'complete'].includes(j.status), 'INVALID_PROOF_STATE');
  assert(Object.keys(j.resources).sort().join(',') === 'case,draft,wrapper' && new Set(Object.values(j.resources).map(r => r.id)).size === 3, 'INVALID_OWNED_RESOURCES');
  for (const [label, r] of Object.entries(j.resources)) { assert(uuid(r.id) && r.slug.includes(j.runId) && r.title.includes(j.runId) && r.slug.length <= 63 && (r.publicationId === null || uuid(r.publicationId)), 'INVALID_RESOURCE_PLAN'); if (r.content) assert('kind' in r.content && r.content.kind === (label === 'case' ? 'case' : 'page') && r.content.slug === r.slug && r.content.title === r.title, 'RESOURCE_CONTENT_IDENTITY_CHANGED'); }
  assert(KEYS.every(k => uuid(j.operationIds[k])) && new Set(Object.values(j.operationIds)).size === KEYS.length && Object.keys(j.operationIds).length === KEYS.length && j.operationIds['draft-create'] === j.resources.draft.id && j.operationIds['case-legacy'] === j.resources.case.id && j.operationIds['wrapper-create'] === j.resources.wrapper.id, 'INVALID_OPERATION_IDENTITIES');
  const casePath = M4_ROUTES.resource(j.tenantId, 'case', j.resources.case.id, 'vi'), wrapperPath = M4_ROUTES.resource(j.tenantId, 'page', j.resources.wrapper.id, 'vi');
  const routes: Record<Key, [string, 'POST' | 'PUT']> = { 'draft-create': [M4_ROUTES.resources(j.tenantId, 'page') + '?locale=vi', 'POST'], 'case-legacy': [M3_ROUTES.resources(j.tenantId, 'case'), 'POST'], 'case-adopt': [casePath, 'PUT'], 'case-grant': [casePath + '/permissions', 'POST'], 'case-publish': [casePath + '/publish', 'POST'], 'wrapper-create': [M4_ROUTES.resources(j.tenantId, 'page') + '?locale=vi', 'POST'], 'wrapper-publish': [wrapperPath + '/publish', 'POST'], 'case-withdraw': [casePath + '/withdrawal', 'POST'], 'cleanup-wrapper': [wrapperPath + '/unpublish', 'POST'], 'cleanup-case': [casePath + '/unpublish', 'POST'] };
  for (const [key, op] of Object.entries(j.operations)) { assert(KEYS.includes(key as Key), 'UNKNOWN_COMMAND'); const target = routes[key as Key]; assert(op.id === j.operationIds[key as Key] && op.body.operationId === op.id && op.path === target[0] && op.method === target[1] && op.hash === searchProofHash(op.body) && typeof op.attempted === 'boolean' && typeof op.done === 'boolean' && (!op.done || op.attempted && op.reply?.operationId === op.id && op.reply.draft.tenantId === j.tenantId), 'INVALID_OWNED_COMMAND'); }
  assert(j.permissionId === null || uuid(j.permissionId), 'INVALID_PERMISSION');
  for (const a of j.attempts) assert(uuid(a.id) && (!a.privateLog || a.privateLog === `.local/lacvan-search-${j.runId}-${a.id}.log`) && (!a.testSha256 || hex(a.testSha256)) && a.http.samples.length <= 16, 'INVALID_ATTEMPT');
}
export function searchProofChildEnvironment(j: SearchProofJournal, migrationUrl: string): Record<string, string> {
  assert(typeof migrationUrl === 'string' && migrationUrl.length > 0, 'MIGRATION_ENVIRONMENT_REQUIRED');
  return { S02_MIGRATION_DATABASE_URL: migrationUrl, LACVAN_SEARCH_INTEGRATION: '1', LACVAN_TEST_TENANT_ID: j.tenantId, LACVAN_TEST_DRAFT_ONLY_ID: j.resources.draft.id, LACVAN_TEST_WITHDRAWN_ID: j.resources.wrapper.id, LACVAN_SEARCH_TEST_QUERY: 'nha' };
}
export function searchProofBaseContent(j: SearchProofJournal): { draft: BuilderContent; case: DentalContent } {
  const r = j.resources;
  return {
    draft: parseM4Content('page', { kind: 'page', slug: r.draft.slug, title: r.draft.title, summary: 'Thông tin riêng chưa được công bố.', seo: { title: '', description: '' }, sections: [{ id: 'text', type: 'rich_text', hidden: false, body: legacyDocument('Ghi chú riêng của phòng khám.') }] }) as BuilderContent,
    case: parseM4Content('case', { kind: 'case', slug: r.case.slug, title: r.case.title, summary: 'Một cuộc trao đổi được viết mới cho kiểm chứng riêng trong môi trường local.', body: legacyDocument('Nhân vật và nội dung hoàn toàn hư cấu; không sử dụng thông tin bệnh nhân.'), seo: { title: '', description: '' }, references: [], image: null }) as DentalContent,
  };
}
export function searchProofWrapperContent(j: SearchProofJournal, casePublicationId: string): BuilderContent {
  assert(uuid(casePublicationId), 'OWNED_CASE_PUBLICATION_REQUIRED'); const r = j.resources;
  return parseM4Content('page', { kind: 'page', slug: r.wrapper.slug, title: r.wrapper.title, summary: 'Trang thông tin chỉ hiển thị khi nội dung được liên kết còn đủ điều kiện công bố.', seo: { title: '', description: '' }, sections: [{ id: 'required-case', type: 'cases', hidden: false, title: 'Nội dung liên kết', references: [{ kind: 'case', id: r.case.id, publicationId: casePublicationId }], required: true }] }) as BuilderContent;
}
export function searchProofLatency(samples: Sample[]) { assert(samples.length > 0 && samples.every(s => Number.isFinite(s.milliseconds) && s.milliseconds >= 0), 'NO_VALID_SAMPLES'); const times = samples.map(s => s.milliseconds).sort((a, b) => a - b); return { n: times.length, min: times[0], max: times.at(-1)!, p95: times[Math.ceil(times.length * 0.95) - 1], scope: 'Observed local HTTP search requests in this bounded proof, including rejection checks' }; }
export function assertSearchProofCleanup(j: SearchProofJournal, label: 'case' | 'wrapper', current: M4Variant) {
  const r = j.resources[label], source = j.operations[label === 'case' ? 'case-adopt' : 'wrapper-create'];
  assert(r.content && source?.done && current.tenantId === j.tenantId && current.id === r.id && current.kind === (label === 'case' ? 'case' : 'page') && current.locale === 'vi' && current.version === (label === 'case' ? 2 : 1) && searchProofHash(current.content) === searchProofHash(r.content) && searchProofHash(source.body.content) === searchProofHash(r.content), 'CLEANUP_CONTENT_OR_OWNER_CHANGED');
  if (current.activePublication) assert(r.publicationId && current.publicationId === r.publicationId && current.publicationVersion === 1 && current.publishedVersion === current.version, 'CLEANUP_PUBLICATION_CHANGED');
  else assert(current.publicationId === null && current.publicationVersion <= 1, 'CLEANUP_HEAD_CHANGED');
}
/** Accept only this tenant root or a descendant. Prefix-sharing tenants and encoded paths are not owned. */
export function isOwnedSearchProofPath(path: unknown, tenantSlug: string): boolean {
  if (typeof path !== 'string' || !/^[-a-z0-9]+$/.test(tenantSlug) || /[\\\s%?#]/.test(path)) return false;
  const root = '/' + tenantSlug, parts = path.split('/').slice(1); if (parts.at(-1) === '') parts.pop(); return (path === root || path.startsWith(root + '/')) && parts.every(part => part !== '.' && part !== '..' && part !== '');
}
export function planSearchProofHttpOnlyAttempt(j: SearchProofJournal, testSha256: string, now = new Date()): Attempt {
  assert(j.status === 'complete' && hex(testSha256), 'HTTP_ONLY_COMPLETED_PROOF_REQUIRED');
  const prior = [...j.attempts].reverse().find(a => a.mode !== 'http-only' && !a.sqlReusedFrom && a.endedAt && a.summary && a.sql.status === 'PASS' && a.sql.exitCode === 0 && a.sql.tests === 5 && a.cleanup === 'PASS' && a.testSha256 === testSha256);
  assert(prior, 'HTTP_ONLY_EXACT_SQL_PROOF_REQUIRED');
  for (const key of ['draft-create', 'case-legacy', 'case-adopt', 'case-grant', 'case-publish', 'wrapper-create', 'wrapper-publish', 'case-withdraw', 'cleanup-wrapper'] as const) assert(j.operations[key]?.done, 'HTTP_ONLY_COMPLETED_FIXTURES_REQUIRED');
  const canonicalContent = searchProofBaseContent(j);
  assert(searchProofHash(j.resources.draft.content) === searchProofHash(canonicalContent.draft) && searchProofHash(j.resources.case.content) === searchProofHash(canonicalContent.case) && j.resources.case.publicationId && searchProofHash(j.resources.wrapper.content) === searchProofHash(searchProofWrapperContent(j, j.resources.case.publicationId)), 'HTTP_ONLY_CANONICAL_CONTENT_CHANGED');
  return { id: randomUUID(), mode: 'http-only', sqlReusedFrom: prior.id, startedAt: now.toISOString(), endedAt: null, privateLog: null, testSha256, sql: { ...prior.sql }, http: { status: 'NOT_RUN', samples: [] }, cleanup: 'NOT_RUN', error: null, summary: null };
}
export function assertSearchProofHttpOnlyState(j: SearchProofJournal, label: 'draft' | 'case' | 'wrapper', current: M4Variant) {
  const r = j.resources[label], key = label === 'draft' ? 'draft-create' : label === 'wrapper' ? 'cleanup-wrapper' : j.operations['cleanup-case']?.done ? 'cleanup-case' : 'case-withdraw';
  const receipt = j.operations[key]?.reply?.draft as M4Variant | undefined;
  assert(receipt && !receipt.activePublication && receipt.publicationId === null && !current.activePublication && current.publicationId === null && r.content && searchProofHash(current.content) === searchProofHash(r.content), 'HTTP_ONLY_INACTIVE_CONTENT_REQUIRED');
  for (const field of ['id', 'tenantId', 'kind', 'locale', 'version', 'publicationVersion', 'publicationRevision', 'publishedVersion', 'activePublication', 'publicationId'] as const) assert(current[field] === receipt[field], 'HTTP_ONLY_RESOURCE_STATE_CHANGED');
  assert(current.id === r.id && current.tenantId === j.tenantId && current.kind === (label === 'case' ? 'case' : 'page') && current.locale === 'vi', 'HTTP_ONLY_RESOURCE_OWNER_CHANGED');
  if (label === 'draft') assert(current.publicationVersion === 0 && current.publicationRevision === 0 && current.publishedVersion === null && r.publicationId === null, 'HTTP_ONLY_DRAFT_WAS_PUBLISHED');
}
async function directory() { const d = await lstat('.local'); assert(d.isDirectory() && !d.isSymbolicLink() && d.uid === process.getuid?.() && (d.mode & 0o777) === 0o700, 'UNSAFE_DIRECTORY'); }
async function privateJson<T>(path: string): Promise<T> { await directory(); const f = await lstat(path); assert(f.isFile() && !f.isSymbolicLink() && f.nlink === 1 && f.uid === process.getuid?.() && (f.mode & 0o777) === 0o600 && f.size <= 4_194_304, 'UNSAFE_PRIVATE_FILE'); return JSON.parse(await readFile(path, 'utf8')) as T; }
async function lock(f: LacVanFixtures) { await directory(); const claim = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, pid: process.pid, nonce: randomUUID() }; try { await writeFile(LOCK, JSON.stringify(claim), { flag: 'wx', mode: 0o600 }); } catch (e) { if (!(e && typeof e === 'object' && 'code' in e && e.code === 'EEXIST')) throw e; const old = await privateJson<typeof claim>(LOCK); assert(old.owner === OWNER && old.fixtureRun === f.runId && old.tenantId === f.tenant.id && uuid(old.nonce) && Number.isSafeInteger(old.pid) && old.pid > 1, 'UNOWNED_LOCK'); let dead = false; try { process.kill(old.pid, 0); } catch (failure) { dead = !!failure && typeof failure === 'object' && 'code' in failure && failure.code === 'ESRCH'; } assert(dead && searchProofHash(await privateJson(LOCK)) === searchProofHash(old), 'PROOF_ALREADY_RUNNING'); await unlink(LOCK); await writeFile(LOCK, JSON.stringify(claim), { flag: 'wx', mode: 0o600 }); } return async () => { assert(searchProofHash(await privateJson(LOCK)) === searchProofHash(claim), 'LOCK_CHANGED'); await unlink(LOCK); }; }
class Runner {
  private retainedHistory: { operations: string; attempts: string; count: number } | null = null;
  constructor(readonly j: SearchProofJournal, private readonly f: LacVanFixtures, private readonly http: LacVanHttp) {}
  private async store() { const old = await privateJson<SearchProofJournal>(JOURNAL); validateSearchProof(old, this.f); assert(old.runId === this.j.runId && old.generation === this.j.generation, 'JOURNAL_CHANGED'); if (this.retainedHistory) { const retained = this.retainedHistory; assert([old, this.j].every(j => searchProofHash(j.operations) === retained.operations && searchProofHash(j.attempts.slice(0, retained.count)) === retained.attempts), 'HTTP_ONLY_HISTORY_CHANGED'); } this.j.generation++; validateSearchProof(this.j, this.f); const temp = `.local/lacvan-search-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(this.j, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, JOURNAL); }
  private async command(key: Key, path: string, method: 'POST' | 'PUT', prepare: () => Record<string, unknown>): Promise<Reply> {
    let op = this.j.operations[key]; if (op?.done) return op.reply!;
    if (!op) { const body = { ...prepare(), operationId: this.j.operationIds[key] }; op = { id: this.j.operationIds[key], path, method, body, hash: searchProofHash(body), attempted: false, done: false, reply: null }; this.j.operations[key] = op; await this.store(); }
    assert(op.path === path && op.method === method && op.hash === searchProofHash(op.body), 'COMMAND_PLAN_CHANGED'); this.j.stage = key; op.attempted = true; await this.store();
    const reply = await this.http.command<Reply>(op.path, op.method, op.body); assert(reply.operationId === op.id && reply.draft.tenantId === this.j.tenantId, 'COMMAND_RECEIPT_CHANGED'); op.reply = reply; op.done = true; await this.store(); return reply;
  }
  private resourcePath(label: 'case' | 'wrapper' | 'draft') { return M4_ROUTES.resource(this.j.tenantId, label === 'case' ? 'case' : 'page', this.j.resources[label].id, 'vi'); }
  private async read(label: 'case' | 'wrapper' | 'draft') { const current = await this.http.get<M4Variant>(this.resourcePath(label)); const r = this.j.resources[label]; assert(current.id === r.id && current.tenantId === this.j.tenantId && current.kind === (label === 'case' ? 'case' : 'page') && current.locale === 'vi', 'RESOURCE_IDENTITY_CHANGED'); return current; }
  private async publish(label: 'case' | 'wrapper', current: M4Variant) { const config = await this.http.get<M4Variant>(M4_ROUTES.config(this.j.tenantId, 'vi')); assert(config.id === this.j.tenantId && config.activePublication && config.publicationId, 'PUBLISHED_CONFIG_REQUIRED'); const reply = await this.command(label === 'case' ? 'case-publish' : 'wrapper-publish', this.resourcePath(label) + '/publish', 'POST', () => ({ expectedVersion: current.version, expectedPublicationVersion: current.publicationVersion, expectedPublicationRevision: current.publicationRevision, expectedConfigPublicationId: config.publicationId })); const result = reply as M4CommandResult; assert(result.draft.activePublication && result.draft.publicationId && result.draft.id === this.j.resources[label].id && searchProofHash(result.draft.content) === searchProofHash(this.j.resources[label].content), 'PUBLICATION_RECEIPT_CHANGED'); this.j.resources[label].publicationId = result.draft.publicationId; await this.store(); return result.draft; }
  private async prepare() {
    const r = this.j.resources;
    if (!r.draft.content) { const content = searchProofBaseContent(this.j); r.draft.content = content.draft; r.case.content = content.case; await this.store(); }
    await this.command('draft-create', M4_ROUTES.resources(this.j.tenantId, 'page') + '?locale=vi', 'POST', () => ({ content: r.draft.content }));
    await this.command('case-legacy', M3_ROUTES.resources(this.j.tenantId, 'case'), 'POST', () => ({ content: r.case.content }));
    const source = await this.read('case'); const adopted = await this.command('case-adopt', this.resourcePath('case'), 'PUT', () => { assert(source.virtual && source.version === 1 && searchProofHash(source.content) === searchProofHash(r.case.content) && source.legacySource?.current, 'LEGACY_CASE_CHANGED'); return { expectedVersion: source.version, content: r.case.content, expectedLegacyState: source.legacySource.current }; }) as M4CommandResult;
    const grant = await this.command('case-grant', this.resourcePath('case') + '/permissions', 'POST', () => ({ expectedVersion: adopted.draft.version, revision: adopted.draft.version, scope: { type: 'text' }, evidenceReference: `GCMS-LACVAN-001 original authored fictional narrative; no patient or patient consent. Owned search proof ${this.j.runId}` })) as M4CommandResult;
    assert(grant.permission?.resourceId === r.case.id && grant.permission.scope.type === 'text' && grant.permission.revision === adopted.draft.version, 'OWNED_TEXT_PERMISSION_REQUIRED'); this.j.permissionId = grant.permission.id; await this.store();
    const publishedCase = await this.publish('case', adopted.draft);
    if (!r.wrapper.content) { r.wrapper.content = searchProofWrapperContent(this.j, publishedCase.publicationId!); await this.store(); }
    const created = await this.command('wrapper-create', M4_ROUTES.resources(this.j.tenantId, 'page') + '?locale=vi', 'POST', () => ({ content: r.wrapper.content })) as M4CommandResult;
    await this.publish('wrapper', created.draft);
    await this.command('case-withdraw', this.resourcePath('case') + '/withdrawal', 'POST', () => ({ expectedVersion: adopted.draft.version, permissionId: this.j.permissionId, reason: 'Withdraw the text permission for this newly owned local regression narrative.' }));
    const [draft, currentCase, wrapper] = await Promise.all([this.read('draft'), this.read('case'), this.read('wrapper')]);
    assert(draft.publicationVersion === 0 && !draft.activePublication && draft.publicationId === null && searchProofHash(draft.content) === searchProofHash(r.draft.content), 'DRAFT_WITNESS_CHANGED');
    assertSearchProofCleanup(this.j, 'case', currentCase); assert(!currentCase.activePublication && currentCase.publicationVersion === 1 && currentCase.publicationId === null, 'WITHDRAWAL_MUST_REVOKE_CASE_HEAD');
    assertSearchProofCleanup(this.j, 'wrapper', wrapper); assert(wrapper.activePublication && wrapper.publicationId === r.wrapper.publicationId, 'WRAPPER_HEAD_REQUIRED_DURING_PROOF');
    const permissions = await this.http.get<{ permission: { id: string; withdrawnAt: string | null } } | { id: string; withdrawnAt: string | null }>(this.resourcePath('case') + '/permissions/' + this.j.permissionId); const permission = 'permission' in permissions ? permissions.permission : permissions; assert(permission.id === this.j.permissionId && permission.withdrawnAt, 'WITHDRAWN_TEXT_WITNESS_REQUIRED');
    const publicWrapper = await this.http.request(M4_ROUTES.publicPage(this.j.tenantSlug, 'vi', 'page', r.wrapper.slug)); assert(publicWrapper.status === 404, 'WITHDRAWAL_DEPENDENT_PAGE_EXPOSED');
    this.j.status = 'prepared'; this.j.stage = 'three-owned-witnesses-prepared'; await this.store();
  }
  private async sql(attempt: Attempt) {
    this.j.stage = 'sql-read-only-proof'; attempt.privateLog = `.local/lacvan-search-${this.j.runId}-${attempt.id}.log`; attempt.testSha256 = createHash('sha256').update(await readFile(TEST)).digest('hex'); await this.store();
    const env = searchProofChildEnvironment(this.j, process.env.S02_MIGRATION_DATABASE_URL ?? ''); const log = await open(attempt.privateLog, 'wx', 0o600);
    try { const child = Bun.spawn([process.execPath, '--no-env-file', 'test', TEST], { cwd: process.cwd(), env, stdout: log.fd, stderr: log.fd }); const deadline = setTimeout(() => child.kill('SIGTERM'), 90_000); try { attempt.sql.exitCode = await child.exited; } finally { clearTimeout(deadline); } }
    finally { await log.close(); }
    const output = await readFile(attempt.privateLog, 'utf8'), passed = /\b(\d+) pass\b/.exec(output), failed = /\b(\d+) fail\b/.exec(output), assertions = /\b(\d+) expect\(\) calls/.exec(output);
    attempt.sql.tests = passed ? Number(passed[1]) : null; attempt.sql.assertions = assertions ? Number(assertions[1]) : null;
    attempt.sql.status = attempt.sql.exitCode === 0 && attempt.sql.tests === 5 && Number(failed?.[1]) === 0 ? 'PASS' : 'FAIL'; await this.store();
  }
  private async httpProof(attempt: Attempt) {
    this.j.stage = 'http-search-proof'; attempt.http.status = 'FAIL'; await this.store();
    const base = M4_ROUTES.search(this.j.tenantSlug, 'vi'), forbidden = new Set([this.j.resources.draft.id, this.j.resources.case.id, this.j.resources.wrapper.id]);
    const request = async (label: string, path: string, expectedStatus = 200) => {
      assert(attempt.http.samples.length < 16, 'SEARCH_REQUEST_BUDGET_EXCEEDED'); const start = performance.now(), response = await this.http.request<M4PublicSearch>(path), elapsed = Math.round((performance.now() - start) * 100) / 100;
      attempt.http.samples.push({ label, status: response.status, milliseconds: elapsed, items: response.status === 200 && Array.isArray(response.value.items) ? response.value.items.length : null, continued: response.status === 200 ? response.value.nextCursor !== null : null }); await this.store(); assert(response.status === expectedStatus, 'SEARCH_STATUS_MISMATCH');
      if (response.status === 200) { const value = response.value; assert(value.schemaVersion === 4 && value.locale === (path.includes('/en/') ? 'en' : 'vi') && Array.isArray(value.items) && value.items.length <= 20 && (value.nextCursor === null || typeof value.nextCursor === 'string' && value.nextCursor.startsWith('s2_')) && !('resumeAfter' in value), 'INVALID_PUBLIC_SEARCH_SHAPE'); assert(value.config?.content.theme === 'signature' && value.config.signature?.navigation.length, 'PUBLISHED_SIGNATURE_MENU_REQUIRED'); assert(value.items.every(i => !forbidden.has(i.id) && isOwnedSearchProofPath(i.path, this.j.tenantSlug) && i.locale === value.locale), 'PRIVATE_OR_WRONG_TENANT_SEARCH_ITEM'); }
      return response.value;
    };
    const exhaust = async (label: string, query: string) => { let cursor: string | null = null, firstCursor: string | null = null; const ids = new Set<string>(), items: M4PublicSearch['items'] = [], cursors = new Set<string>(); do { const params = new URLSearchParams({ q: query, pageSize: '20', ...(cursor ? { cursor } : {}) }); const value = await request(label, base + '?' + params); if (firstCursor === null && value.nextCursor) firstCursor = value.nextCursor; for (const item of value.items) { const key = item.kind + ':' + item.id; assert(!ids.has(key), 'SEARCH_DUPLICATE_ITEM'); ids.add(key); items.push(item); } cursor = value.nextCursor; if (cursor) { assert(!cursors.has(cursor), 'SEARCH_CURSOR_CYCLE'); cursors.add(cursor); } } while (cursor); return { items, firstCursor }; };
    await request('missing-query', base, 400);
    const absent = await exhaust('absent-query', 'zzzz-lacvan-search-absent-alpha'); assert(absent.items.length === 0 && absent.firstCursor, 'MISSING_EMPTY_WINDOW_CONTINUATION');
    const home = await this.http.get<M4Resolution>(M4_ROUTES.publicPage(this.j.tenantSlug, 'vi', 'home', 'home')); assert(home.resolution === 'page', 'PUBLISHED_HOME_REQUIRED');
    const content = home.page.content as BuilderContent, searchable = `${content.title} ${content.summary} ${content.slug}`.normalize('NFC').toLowerCase(), query = searchable.includes('nha') ? 'nha' : content.title.normalize('NFC').trim().toLowerCase();
    const matching = await exhaust('matching-query', query); assert(matching.items.some(i => i.id === home.page.id && i.kind === 'home') && matching.firstCursor, 'KNOWN_ELIGIBLE_MATCH_SKIPPED_OR_FALSE_END');
    const draft = await exhaust('draft-title', this.j.resources.draft.title.toLowerCase()); assert(draft.items.length === 0, 'DRAFT_TITLE_EXPOSED');
    const withheld = await exhaust('withdrawal-dependent-title', this.j.resources.wrapper.title.toLowerCase()); assert(withheld.items.length === 0, 'WITHHELD_TITLE_EXPOSED');
    const cursor = absent.firstCursor, tampered = cursor.slice(0, 10) + (cursor[10] === 'A' ? 'B' : 'A') + cursor.slice(11), params = (q: string, token: string, pageSize = '20') => new URLSearchParams({ q, cursor: token, pageSize }).toString();
    await request('tampered-cursor', base + '?' + params('zzzz-lacvan-search-absent-alpha', tampered), 400);
    await request('cross-query-cursor', base + '?' + params('zzzz-lacvan-search-absent-beta', cursor), 400);
    await request('cross-size-cursor', base + '?' + params('zzzz-lacvan-search-absent-alpha', cursor, '19'), 400);
    await request('cross-locale-cursor', M4_ROUTES.search(this.j.tenantSlug, 'en') + '?' + params('zzzz-lacvan-search-absent-alpha', cursor), 400);
    attempt.http.status = 'PASS'; await this.store();
  }
  private async cleanup(attempt: Attempt) {
    this.j.stage = 'owned-cleanup'; let failure: unknown;
    for (const label of ['wrapper', 'case'] as const) {
      if (!this.j.operations[label === 'wrapper' ? 'wrapper-create' : 'case-adopt']?.done) continue;
      try { const current = await this.read(label); assertSearchProofCleanup(this.j, label, current); if (current.activePublication) { await this.command(label === 'wrapper' ? 'cleanup-wrapper' : 'cleanup-case', this.resourcePath(label) + '/unpublish', 'POST', () => ({ expectedVersion: current.version, expectedPublicationRevision: current.publicationRevision })); const after = await this.read(label); assertSearchProofCleanup(this.j, label, after); assert(!after.activePublication && after.publicationId === null, 'OWNED_UNPUBLISH_NOT_APPLIED'); } } catch (error) { failure = error; }
    }
    if (this.j.operations['draft-create']?.done) { const draft = await this.read('draft'); assert(draft.publicationVersion === 0 && !draft.activePublication && searchProofHash(draft.content) === searchProofHash(this.j.resources.draft.content), 'DRAFT_CLEANUP_GUARD_CHANGED'); }
    attempt.cleanup = failure ? 'FAIL' : 'PASS'; await this.store(); if (failure) throw failure;
  }
  private async verifyHttpOnlyState() { for (const label of ['draft', 'case', 'wrapper'] as const) assertSearchProofHttpOnlyState(this.j, label, await this.read(label)); }
  async runHttpOnly() {
    const sha = createHash('sha256').update(await readFile(TEST)).digest('hex'), attempt = planSearchProofHttpOnlyAttempt(this.j, sha);
    await this.http.login(); await this.verifyHttpOnlyState();
    this.retainedHistory = { operations: searchProofHash(this.j.operations), attempts: searchProofHash(this.j.attempts), count: this.j.attempts.length };
    this.j.attempts.push(attempt); await this.store(); let failure: unknown;
    try { await this.httpProof(attempt); }
    catch (error) { failure = error; attempt.error = { stage: this.j.stage, code: error instanceof ProofFailure ? error.code : 'PRIVATE_OPERATION_FAILED' }; await this.store(); }
    finally { this.j.stage = 'http-only-inactive-state-verification'; try { await this.verifyHttpOnlyState(); attempt.cleanup = 'PASS'; } catch (error) { failure ??= error; attempt.cleanup = 'FAIL'; attempt.error ??= { stage: this.j.stage, code: error instanceof ProofFailure ? error.code : 'PRIVATE_STATE_VERIFICATION_FAILED' }; } await this.store(); }
    await this.finish(attempt, failure);
  }
  async run() {
    assert(this.j.status !== 'complete', 'PROOF_ALREADY_COMPLETED_RETAIN_EXISTING_EVIDENCE');
    const attempt: Attempt = { id: randomUUID(), startedAt: new Date().toISOString(), endedAt: null, privateLog: null, testSha256: null, sql: { status: 'NOT_RUN', exitCode: null, tests: null, assertions: null }, http: { status: 'NOT_RUN', samples: [] }, cleanup: 'NOT_RUN', error: null, summary: null }; this.j.attempts.push(attempt); await this.store();
    let failure: unknown;
    try { await this.http.login(); await this.prepare(); await this.sql(attempt); await this.httpProof(attempt); if (attempt.sql.status !== 'PASS') throw new ProofFailure('READ_ONLY_SQL_PROOF_FAILED'); }
    catch (error) { failure = error; attempt.error = { stage: this.j.stage, code: error instanceof ProofFailure ? error.code : 'PRIVATE_OPERATION_FAILED' }; await this.store(); }
    finally { try { await this.cleanup(attempt); } catch (error) { failure ??= error; attempt.error ??= { stage: this.j.stage, code: error instanceof ProofFailure ? error.code : 'OWNED_CLEANUP_FAILED' }; } }
    await this.finish(attempt, failure);
  }
  private async finish(attempt: Attempt, failure: unknown) {
    const httpOnly = attempt.mode === 'http-only'; attempt.endedAt = new Date().toISOString(); attempt.summary = `docs/evidence/lacvan/search-proof-${this.j.runId}-${attempt.id}.json`;
    const summary = { task: 'GCMS-LACVAN-001', owner: OWNER, mode: httpOnly ? 'http-only' : 'full', status: !failure && attempt.sql.status === 'PASS' && attempt.http.status === 'PASS' && attempt.cleanup === 'PASS' ? 'PASS' : 'FAIL', sql: { ...attempt.sql, execution: httpOnly ? 'REUSED_NOT_RERUN' : 'EXECUTED', sourceAttemptId: attempt.sqlReusedFrom ?? attempt.id, testSha256: attempt.testSha256 }, http: { status: attempt.http.status, maximumSearchRequests: 16, samples: attempt.http.samples, latency: attempt.http.samples.length ? searchProofLatency(attempt.http.samples) : null }, sourceGate: attempt.sql.status === 'PASS' ? httpOnly ? 'PASS: reused prior SQL definition assertions with the exact test source SHA; not rerun' : 'PASS: read-only SQL definition assertions' : 'NOT_VERIFIED: inspect retained private SQL log', witness: httpOnly ? 'All three witnesses remain inactive. The prior SQL attempt checked the required-reference wrapper while its head was still active.' : 'Published wrapper has a required reference to the normally text-withdrawn case; case head is revoked, wrapper head stays active only during proof', cleanup: httpOnly ? { status: attempt.cleanup, mode: 'read-only-existing-inactive-head-verification', contentCommands: 0 } : { status: attempt.cleanup, wrapper: 'ordinary CMS unpublish if still active', case: 'normal withdrawal revokes head; unpublish only if an interrupted preparation left it active', draft: 'retained privately and never published' }, error: attempt.error, endedAt: attempt.endedAt, limits: ['Measurements cover only these owned local requests.', 'No full endpoint performance bound is claimed.', httpOnly ? 'The HTTP-only run executes no SQL tests or content commands. Previous attempts and command bytes remain unchanged.' : 'Mutation routes are restricted to the three new owned identities; catalog, home, configuration and worker routes are outside the allowlist.'] };
    await writeFile(attempt.summary, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o644 }); this.j.status = 'complete'; this.j.stage = httpOnly ? attempt.cleanup === 'PASS' ? 'http-only-proof-retained-inactive-heads-verified' : 'http-only-proof-retained-state-changed' : attempt.cleanup === 'PASS' ? 'proof-retained-owned-cleanup-complete' : 'proof-retained-cleanup-incomplete'; await this.store(); console.info(JSON.stringify({ status: summary.status, evidence: attempt.summary, sql: attempt.sql.status, http: attempt.http.status, cleanup: attempt.cleanup, searchRequests: attempt.http.samples.length, credentialsPrinted: false })); if (summary.status !== 'PASS') process.exitCode = 1;
  }
}
async function main() {
  const args = process.argv.slice(2), httpOnly = args.join(' ') === '--local-lacvan --http-only';
  assert(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && (args.join(' ') === '--local-lacvan' || httpOnly), 'EXPLICIT_LOCAL_SEARCH_PROOF_REQUIRED');
  if (!httpOnly) validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration');
  const { readLacVanFixtures } = await import('./lacvan-fixtures'), f = await readLacVanFixtures(); assert(f.status === 'complete', 'COMPLETE_OWNED_CLINIC_REQUIRED'); const release = await lock(f);
  try { let j: SearchProofJournal; try { j = await privateJson<SearchProofJournal>(JOURNAL); } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; assert(!httpOnly, 'HTTP_ONLY_EXISTING_JOURNAL_REQUIRED'); j = planSearchProof(f); await writeFile(JOURNAL, JSON.stringify(j, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } validateSearchProof(j, f); const runner = new Runner(j, f, new LacVanHttp(f.tenant.id, f.tenant.slug, f.identities.find(i => i.label === 'Owner')!)); if (httpOnly) await runner.runHttpOnly(); else await runner.run(); }
  finally { await release(); }
}
if (import.meta.main) void main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', phase: 'lacvan-search-proof', code: error instanceof ProofFailure ? error.code : 'PRIVATE_OPERATION_FAILED', detailsRedacted: true })); process.exitCode = 1; });
