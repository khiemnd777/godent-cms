import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { assertSearchProofCleanup, assertSearchProofHttpOnlyState, isOwnedSearchProofPath, planSearchProof, planSearchProofHttpOnlyAttempt, searchProofBaseContent, searchProofChildEnvironment, searchProofHash, searchProofLatency, searchProofWrapperContent, validateSearchProof } from './lacvan-search-proof';
import type { LacVanFixtures } from './lacvan-fixtures';
import type { M4CommandResult, M4Variant } from '../apps/api/src/contracts/m4';

const fixture: LacVanFixtures = { owner: 'GCMS-LACVAN-001-v1', runId: randomUUID(), status: 'complete', createdAt: '2026-10-17T00:00:00.000Z', tenant: { id: randomUUID(), slug: 'lac-van', name: 'Nha khoa Lạc Vân' }, identities: (['Platform', 'Owner', 'Peer'] as const).map(label => ({ label, userId: randomUUID(), name: label, email: 'unused@local.example.test', password: 'never-used-by-pure-checks' })) };
function wrapperScenario() {
  const j = planSearchProof(fixture), content = searchProofBaseContent(j); j.resources.draft.content = content.draft; j.resources.case.content = content.case;
  j.resources.case.publicationId = randomUUID(); j.resources.wrapper.content = searchProofWrapperContent(j, j.resources.case.publicationId); j.resources.wrapper.publicationId = randomUUID();
  const r = j.resources.wrapper, current: M4Variant = { id: r.id, tenantId: j.tenantId, kind: 'page', locale: 'vi', version: 1, publicationVersion: 1, publicationRevision: 1, publishedVersion: 1, activePublication: true, publicationId: r.publicationId, slugLocked: true, updatedAt: '2026-10-17T00:00:00.000Z', content: r.content!, legacy: false };
  const body = { operationId: j.operationIds['wrapper-create'], content: r.content }, reply: M4CommandResult = { operationId: body.operationId, replayed: false, draft: { ...current, activePublication: false, publicationVersion: 0, publicationRevision: 0, publishedVersion: null, publicationId: null } };
  j.operations['wrapper-create'] = { id: body.operationId, path: `/api/tenants/${j.tenantId}/site-builder/resources/page?locale=vi`, method: 'POST', body, hash: searchProofHash(body), attempted: true, done: true, reply };
  return { j, current };
}
function completedScenario() {
  const s = wrapperScenario(), j = s.j, casePath = `/api/tenants/${j.tenantId}/site-builder/resources/case/${j.resources.case.id}/vi`, wrapperPath = `/api/tenants/${j.tenantId}/site-builder/resources/page/${j.resources.wrapper.id}/vi`;
  const draft: M4Variant = { ...s.current, id: j.resources.draft.id, content: j.resources.draft.content!, version: 1, publicationVersion: 0, publicationRevision: 0, publishedVersion: null, activePublication: false, publicationId: null };
  const currentCase: M4Variant = { ...s.current, id: j.resources.case.id, kind: 'case', content: j.resources.case.content!, version: 2, publishedVersion: 2, publicationRevision: 2, activePublication: false, publicationId: null };
  const wrapper: M4Variant = { ...s.current, publicationRevision: 2, activePublication: false, publicationId: null };
  function op(key: keyof typeof j.operationIds, path: string, method: 'POST' | 'PUT', content: unknown, current: M4Variant) { const body = { operationId: j.operationIds[key], content }, reply: M4CommandResult = { operationId: body.operationId, replayed: false, draft: current }; j.operations[key] = { id: body.operationId, path, method, body, hash: searchProofHash(body), attempted: true, done: true, reply }; }
  op('draft-create', `/api/tenants/${j.tenantId}/site-builder/resources/page?locale=vi`, 'POST', j.resources.draft.content, draft);
  op('case-legacy', `/api/tenants/${j.tenantId}/content/case`, 'POST', j.resources.case.content, currentCase);
  op('case-adopt', casePath, 'PUT', j.resources.case.content, currentCase);
  op('case-grant', casePath + '/permissions', 'POST', j.resources.case.content, currentCase);
  op('case-publish', casePath + '/publish', 'POST', j.resources.case.content, { ...currentCase, activePublication: true, publicationId: j.resources.case.publicationId, publicationRevision: 1 });
  op('wrapper-publish', wrapperPath + '/publish', 'POST', j.resources.wrapper.content, s.current);
  op('case-withdraw', casePath + '/withdrawal', 'POST', j.resources.case.content, currentCase);
  op('cleanup-wrapper', wrapperPath + '/unpublish', 'POST', j.resources.wrapper.content, wrapper);
  const sha = 'a'.repeat(64), prior = { id: randomUUID(), startedAt: '2026-10-17T00:00:00.000Z', endedAt: '2026-10-17T00:01:00.000Z', privateLog: null, testSha256: sha, sql: { status: 'PASS' as const, exitCode: 0, tests: 5, assertions: 66 }, http: { status: 'FAIL' as const, samples: [] }, cleanup: 'PASS' as const, error: { stage: 'http-search-proof', code: 'PRIVATE_OR_WRONG_TENANT_SEARCH_ITEM' }, summary: 'retained-original-failure.json' };
  j.attempts.push(prior); j.status = 'complete'; return { j, sha, draft, currentCase, wrapper };
}
describe('Lac Van search proof pure safety checks', () => {
  test('plans exactly three fresh owned identities and all command UUIDs before use', () => {
    const j = planSearchProof(fixture); expect(() => validateSearchProof(j, fixture)).not.toThrow(); expect(Object.keys(j.resources)).toHaveLength(3); expect(Object.keys(j.operationIds)).toHaveLength(10); expect(new Set(Object.values(j.operationIds)).size).toBe(10); expect(j.operations).toEqual({});
    const second = planSearchProof(fixture); expect(second.runId).not.toBe(j.runId); for (const r of Object.values(j.resources)) { expect(r.slug).toContain(j.runId); expect(r.title).toContain(j.runId); expect(r.slug.length).toBeLessThanOrEqual(63); expect(Object.values(second.resources).some(other => other.id === r.id)).toBe(false); }
  });
  test('rejects foreign ownership, resource reuse, changed bodies and unowned commands', () => {
    const s = wrapperScenario(); expect(() => validateSearchProof(s.j, fixture)).not.toThrow();
    for (const change of [(j: typeof s.j) => { j.tenantId = randomUUID(); }, (j: typeof s.j) => { j.fixtureRun = randomUUID(); }, (j: typeof s.j) => { j.actorId = randomUUID(); }, (j: typeof s.j) => { j.resources.wrapper.id = j.resources.case.id; }, (j: typeof s.j) => { j.operations['wrapper-create']!.body.content = {}; }, (j: typeof s.j) => { j.operations['wrapper-create']!.path = `/api/tenants/${j.tenantId}/site-builder/config/vi`; }]) { const j = structuredClone(s.j); change(j); expect(() => validateSearchProof(j, fixture)).toThrow(); }
    const changed = structuredClone(s.j); (changed.resources.wrapper.content as { slug: string }).slug = 'an-existing-page'; expect(() => validateSearchProof(changed, fixture)).toThrow();
  });
  test('child SQL test environment has only the migration URL and exact selected flags', () => {
    const j = planSearchProof(fixture), env = searchProofChildEnvironment(j, 'unused-local-role-url');
    expect(Object.keys(env).sort()).toEqual(['LACVAN_SEARCH_INTEGRATION', 'LACVAN_SEARCH_TEST_QUERY', 'LACVAN_TEST_DRAFT_ONLY_ID', 'LACVAN_TEST_TENANT_ID', 'LACVAN_TEST_WITHDRAWN_ID', 'S02_MIGRATION_DATABASE_URL'].sort());
    expect(env.LACVAN_SEARCH_INTEGRATION).toBe('1'); expect(env.LACVAN_TEST_DRAFT_ONLY_ID).toBe(j.resources.draft.id); expect(env.LACVAN_TEST_WITHDRAWN_ID).toBe(j.resources.wrapper.id); expect(env.LACVAN_TEST_WITHDRAWN_ID).not.toBe(j.resources.case.id); expect(env.LACVAN_SEARCH_TEST_QUERY).toBe('nha'); expect(() => searchProofChildEnvironment(j, '')).toThrow();
  });
  test('the wrapper requires only the owned published case without images or invented consent', () => {
    const j = planSearchProof(fixture), base = searchProofBaseContent(j), publicationId = randomUUID(), wrapper = searchProofWrapperContent(j, publicationId);
    expect(base.draft.kind).toBe('page'); expect(base.case.kind === 'case' && base.case.image).toBeNull(); expect(base.case.references).toEqual([]); expect(wrapper.sections).toHaveLength(1);
    const section = wrapper.sections[0]; expect(section.type).toBe('cases'); expect('required' in section && section.required).toBe(true); expect('references' in section && section.references).toEqual([{ kind: 'case', id: j.resources.case.id, publicationId }]); expect(() => searchProofWrapperContent(j, 'not-a-publication')).toThrow();
  });
  test('cleanup requires exact new identity, content, published head and version', () => {
    const { j, current } = wrapperScenario(); expect(() => assertSearchProofCleanup(j, 'wrapper', current)).not.toThrow();
    for (const patch of [{ tenantId: randomUUID() }, { id: randomUUID() }, { kind: 'case' }, { locale: 'en' }, { version: 2 }, { publicationId: randomUUID() }, { publicationVersion: 2 }, { publishedVersion: 2 }, { content: { ...current.content, title: 'Manual edit to preserve' } }]) expect(() => assertSearchProofCleanup(j, 'wrapper', { ...current, ...patch } as M4Variant)).toThrow();
    const withdrawn = { ...current, activePublication: false, publicationId: null, publicationRevision: 2 }; expect(() => assertSearchProofCleanup(j, 'wrapper', withdrawn)).not.toThrow();
    const unowned = structuredClone(j); unowned.operations['wrapper-create']!.done = false; expect(() => assertSearchProofCleanup(unowned, 'wrapper', current)).toThrow();
  });
  test('latency uses nearest-rank p95 and labels the finite observed sample scope', () => {
    const samples = Array.from({ length: 16 }, (_, i) => ({ label: 'local-owned-request', status: 200, milliseconds: (i + 1) * 10, items: 0, continued: false }));
    expect(searchProofLatency(samples)).toMatchObject({ n: 16, min: 10, max: 160, p95: 160 }); expect(searchProofLatency(samples).scope).toContain('bounded proof'); expect(() => searchProofLatency([])).toThrow(); expect(() => searchProofLatency([{ ...samples[0], milliseconds: -1 }])).toThrow();
  });
  test('own tenant roots and VI/EN descendants pass while prefix collisions and path escapes fail', () => {
    for (const path of ['/lac-van', '/lac-van/', '/lac-van/en', '/lac-van/en/', '/lac-van/dich-vu/implant', '/lac-van/en/bac-si/minh-an']) expect(isOwnedSearchProofPath(path, 'lac-van')).toBe(true);
    for (const path of ['/lac-van-other', '/lac-van-other/implant', '/other/lac-van', '//lac-van', 'https://example.test/lac-van', '/lac-van/../other', '/lac-van/./implant', '/lac-van//implant', '/lac-van/%2e%2e/other', '/lac-van?tenant=other', '/lac-van#other', '/lac-van\\other', '/lac-van bad']) expect(isOwnedSearchProofPath(path, 'lac-van')).toBe(false);
  });
  test('HTTP-only admission requires the exact successful SQL source and retained cleanup', () => {
    const s = completedScenario(), before = searchProofHash(s.j), next = planSearchProofHttpOnlyAttempt(s.j, s.sha);
    expect(() => validateSearchProof(s.j, fixture)).not.toThrow(); expect(next.mode).toBe('http-only'); expect(next.sqlReusedFrom).toBe(s.j.attempts[0].id); expect(next.sql).toEqual(s.j.attempts[0].sql); expect(next.privateLog).toBeNull(); expect(searchProofHash(s.j)).toBe(before);
    next.sql.assertions = 99; expect(s.j.attempts[0].sql.assertions).toBe(66);
    expect(() => planSearchProofHttpOnlyAttempt(s.j, 'b'.repeat(64))).toThrow();
    for (const change of [(j: typeof s.j) => { j.status = 'prepared'; }, (j: typeof s.j) => { j.attempts[0].sql.status = 'FAIL'; }, (j: typeof s.j) => { j.attempts[0].sql.tests = 4; }, (j: typeof s.j) => { j.attempts[0].cleanup = 'FAIL'; }, (j: typeof s.j) => { j.operations['cleanup-wrapper']!.done = false; }, (j: typeof s.j) => { (j.resources.wrapper.content as { title: string }).title = 'Changed content'; }]) { const changed = structuredClone(s.j); change(changed); expect(() => planSearchProofHttpOnlyAttempt(changed, s.sha)).toThrow(); }
  });
  test('HTTP-only checks refuse any active, republished, edited or foreign fixture', () => {
    const s = completedScenario(); expect(() => assertSearchProofHttpOnlyState(s.j, 'draft', s.draft)).not.toThrow(); expect(() => assertSearchProofHttpOnlyState(s.j, 'case', s.currentCase)).not.toThrow(); expect(() => assertSearchProofHttpOnlyState(s.j, 'wrapper', s.wrapper)).not.toThrow();
    for (const patch of [{ activePublication: true }, { publicationId: randomUUID() }, { publicationVersion: 2 }, { publicationRevision: 3 }, { publishedVersion: 2 }, { version: 2 }, { tenantId: randomUUID() }, { id: randomUUID() }, { content: { ...s.wrapper.content, title: 'Manual edit to preserve' } }]) expect(() => assertSearchProofHttpOnlyState(s.j, 'wrapper', { ...s.wrapper, ...patch } as M4Variant)).toThrow();
    expect(() => assertSearchProofHttpOnlyState(s.j, 'draft', { ...s.draft, publicationVersion: 1 })).toThrow();
  });
});
