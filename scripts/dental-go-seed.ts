import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { M3_KINDS, M3_ROUTES, type ContentCommandResult, type DentalContent } from '../apps/api/src/contracts/m3';
import { M4_ROUTES, type M4CommandResult, type M4Content, type M4Locale, type M4Variant } from '../apps/api/src/contracts/m4';
import { S03_ROUTES, type PublicationService, type SiteDraft } from '../apps/api/src/contracts/s03';
import { DENTAL_GO_SPEC, dentalGoContent, dentalGoPresentation, type DentalGoContext, type DentalGoEntry } from './dental-go-content';
import { DentalGoHttp } from './dental-go-http';
import { privateDentalGoText, readDentalGoFixtures } from './dental-go-fixtures';

const FILE = '.local/dental-go-seed.json', LOCK = '.local/dental-go-seed.lock', OWNER = 'GCMS-DENTAL-GO-PLUS-SEED-v1';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// PostgreSQL jsonb reorders object keys; array order and actual values remain significant.
const same = isDeepStrictEqual;
function check(v: unknown, message: string): asserts v { if (!v) throw new Error(message); }
interface Operation { path: string; method: 'POST' | 'PUT'; body: Record<string, unknown>; attempted: boolean; result: unknown }
interface Journal { owner: string; fixtureRun: string; tenantId: string; generation: number; complete: boolean; specHash: string; entries: DentalGoEntry[]; operations: Record<string, Operation>; legacyServicePublicationId: string | null }
async function main() {
  check(Bun.version === '1.4.3' && process.cwd() === resolve(import.meta.dir, '..') && process.argv.slice(2).join(' ') === '--local-dental-go --seed', 'Explicit pinned local seed required');
  const f = await readDentalGoFixtures(); check(f.status === 'complete', 'Owned tenant not ready');
  const lock = JSON.stringify({ owner: OWNER, tenantId: f.tenant.id, pid: process.pid }); await writeFile(LOCK, lock, { flag: 'wx', mode: 0o600 });
  try {
    let j: Journal;
    if (await Bun.file(FILE).exists()) j = JSON.parse(await privateDentalGoText(FILE));
    else { j = { owner: OWNER, fixtureRun: f.runId, tenantId: f.tenant.id, generation: 0, complete: false, specHash: hash(DENTAL_GO_SPEC), entries: DENTAL_GO_SPEC.map(s => ({ ...s, id: randomUUID(), legacyCreated: false, publicationIds: {} })), operations: {}, legacyServicePublicationId: null }; await writeFile(FILE, JSON.stringify(j), { flag: 'wx', mode: 0o600 }); }
    check(j.owner === OWNER && j.fixtureRun === f.runId && j.tenantId === f.tenant.id && j.specHash === hash(DENTAL_GO_SPEC) && j.entries.length === DENTAL_GO_SPEC.length && new Set(j.entries.map(e => e.id)).size === j.entries.length, 'Seed ownership/specification mismatch');
    if (j.complete) { console.info(JSON.stringify({ status: 'PASS', phase: 'already-complete', reset: false, laterCmsChangesPreserved: true })); return; }
    const source = JSON.parse(await readFile('docs/design/dental-go-plus/assets.json', 'utf8')) as { task: string; assets: { key: string; alt: { vi: string; en: string }; sha256: string }[] };
    const media = JSON.parse(await privateDentalGoText('.local/dental-go-media.json')) as { owner: string; fixtureRun: string; tenantId: string; assets: { key: string; id: string; revision: number; sha256: string; processed: boolean }[] };
    check(source.task === 'GCMS-DENTAL-GO-PLUS-001' && media.fixtureRun === f.runId && media.tenantId === f.tenant.id && media.assets.length === 10 && media.assets.every(a => a.processed && source.assets.some(s => s.key === a.key && s.sha256 === a.sha256)), 'Owned media not ready');
    const c: DentalGoContext = { entries: j.entries, assets: media.assets.map(a => ({ ...a, alt: source.assets.find(s => s.key === a.key)!.alt })), legacyServicePublicationId: j.legacyServicePublicationId };
    const http = new DentalGoHttp(f.tenant.id, f.tenant.slug, f.identities.find(i => i.label === 'Owner')!); await http.login();
    async function store() { const old = JSON.parse(await privateDentalGoText(FILE)) as Journal; check(old.fixtureRun === j.fixtureRun && old.tenantId === j.tenantId && old.generation === j.generation, 'Concurrent seed change'); j.generation++; const temp = `.local/dental-go-seed-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(j), { flag: 'wx', mode: 0o600 }); await rename(temp, FILE); }
    async function operation<T>(key: string, path: string, method: 'POST' | 'PUT', body: Record<string, unknown>): Promise<T> {
      let op = j.operations[key];
      if (!op) { op = { path, method, body, attempted: false, result: null }; j.operations[key] = op; await store(); }
      check(op.path === path && op.method === method, 'Seed operation context changed');
      if ('content' in body) check(same(op.body.content, body.content), 'Seed content intent changed');
      if (op.result) return op.result as T;
      op.attempted = true; await store(); const result = await http.command<T>(path, method, op.body); op.result = result; await store(); return result;
    }
    async function variant(e: DentalGoEntry, l: M4Locale) { const r = await http.request<M4Variant>(M4_ROUTES.resource(f.tenant.id, e.kind, e.id, l)); check(r.status === 200 || r.status === 404, 'Variant read failed'); return r.status === 200 ? r.value : null; }
    async function publish(draft: M4Variant, key: string) {
      const path = draft.kind === 'config' ? M4_ROUTES.config(f.tenant.id, draft.locale) : M4_ROUTES.resource(f.tenant.id, draft.kind, draft.id, draft.locale);
      const config = draft.kind === 'config' ? null : await http.get<M4Variant>(M4_ROUTES.config(f.tenant.id, draft.locale));
      const body = { operationId: randomUUID(), expectedVersion: draft.version, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedConfigPublicationId: config?.publicationId ?? null };
      const r = await operation<M4CommandResult>(key, path + '/publish', 'POST', body); check(r.draft.activePublication && r.draft.publishedVersion === draft.version && r.draft.publicationId && same(r.draft.content, draft.content), 'Publication mismatch'); return r.draft;
    }
    async function config(l: M4Locale, complete: boolean) {
      const path = M4_ROUTES.config(f.tenant.id, l), current = await http.get<M4Variant>(path), content = dentalGoPresentation(c, l, complete), key = `config-${l}-${complete}`;
      if (j.operations[key + '-publish']?.result) return;
      const r = await operation<M4CommandResult>(key, path, 'PUT', { operationId: randomUUID(), expectedVersion: current.version, content }); await publish(r.draft, key + '-publish');
    }
    for (const l of ['vi', 'en'] as const) await config(l, false);
    // The current CMS owns service identities in S03 and other catalog identities in M3.
    // Freeze all identities before M4 adoption changes publication eligibility.
    for (const e of j.entries.filter(e => e.kind === 'service')) {
      if (!e.legacyCreated) {
        const desired = dentalGoContent(c, e, 'vi', true) as import('../apps/api/src/contracts/s03').ServiceContent;
        const body = { ...desired }; delete body.contentLinks;
        const key = `legacy-${e.key}`, path = S03_ROUTES.services(f.tenant.id);
        let op = j.operations[key]; if (!op) { op = { path, method: 'POST', body: body as unknown as Record<string, unknown>, attempted: false, result: null }; j.operations[key] = op; await store(); }
        let cursor: string | null = null, found: PublicationService | undefined; const seen = new Set<string>();
        do { const page: { items: PublicationService[]; nextCursor: string | null } = await http.get(path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); found = page.items.find(v => v.slug === e.slug); cursor = page.nextCursor; if (cursor) { check(!seen.has(cursor) && seen.size < 10, 'Service cursor mismatch'); seen.add(cursor); } } while (!found && cursor);
        if (found) check(op.attempted, 'Unowned existing service');
        else { op.attempted = true; await store(); found = await http.command<PublicationService>(path, 'POST', op.body); }
        check(found.tenantId === f.tenant.id && same({ slug: found.slug, title: found.title, summary: found.summary, body: found.body, seo: found.seo, coverImage: found.coverImage }, body), 'Legacy service mismatch'); e.id = found.id; e.legacyCreated = true; op.result = { id: found.id }; await store();
      }
      if (e.key === 'service-general' && !j.legacyServicePublicationId) {
        const d = await http.get<PublicationService>(S03_ROUTES.service(f.tenant.id, e.id)), site = await http.get<SiteDraft>(S03_ROUTES.site(f.tenant.id));
        const r = await operation<{ publicationId: string }>('legacy-first-publish', S03_ROUTES.service(f.tenant.id, e.id) + '/publish', 'POST', { requestKey: randomUUID(), expectedDraftVersion: d.draftVersion, expectedPublicationVersion: d.publicationVersion, expectedPublicationRevision: d.publicationRevision, expectedSiteVersion: site.version });
        check(r.publicationId, 'Legacy publication unavailable'); j.legacyServicePublicationId = r.publicationId; c.legacyServicePublicationId = r.publicationId; await store();
      }
    }
    for (const e of j.entries.filter(e => (M3_KINDS as readonly string[]).includes(e.kind))) if (!e.legacyCreated) {
      const content = dentalGoContent(c, e, 'vi', true) as DentalContent;
      const r = await operation<ContentCommandResult>(`legacy-${e.key}`, M3_ROUTES.resources(f.tenant.id, content.kind), 'POST', { operationId: e.id, content }); check(r.draft.id === e.id && r.draft.tenantId === f.tenant.id, 'Legacy resource scope mismatch'); e.legacyCreated = true; await store();
    }
    for (const e of j.entries) for (const l of ['vi', 'en'] as const) {
      if (e.publicationIds[l]) continue;
      const content: M4Content = dentalGoContent(c, e, l), current = await variant(e, l), path = M4_ROUTES.resource(f.tenant.id, e.kind, e.id, l);
      const key = `save-${e.key}-${l}`, prior = j.operations[key];
      if (!prior) check(!current || current.virtual, 'Existing non-owned variant');
      const saved = await operation<M4CommandResult>(key, prior?.path ?? (current ? path : M4_ROUTES.resources(f.tenant.id, e.kind) + '?locale=' + l), prior?.method ?? (current ? 'PUT' : 'POST'), { operationId: current ? randomUUID() : e.id, ...(current ? { expectedVersion: current.version, ...(current.legacySource?.current ? { expectedLegacyState: current.legacySource.current } : {}) } : {}), content });
      check(saved.draft.id === e.id && saved.draft.tenantId === f.tenant.id && same(saved.draft.content, content), 'Saved content mismatch');
      if (e.kind === 'gallery') {
        const g = content as Extract<DentalContent, { kind: 'gallery' }>, images = [g.pairs[0].before, g.pairs[0].after];
        const scopes = [{ type: 'text' }, ...images.map(a => ({ type: 'asset', assetId: a.assetId, assetRevision: a.revision, usage: 'page' }))];
        for (let i = 0; i < scopes.length; i++) await operation(`grant-${e.key}-${l}-${i}`, path + '/permissions', 'POST', { operationId: randomUUID(), expectedVersion: saved.draft.version, revision: saved.draft.version, scope: scopes[i], evidenceReference: 'GCMS-DENTAL-GO-PLUS-001 original AI-created imagined clinic spaces, no real patient material.' });
      }
      const published = await publish(saved.draft, `publish-${e.key}-${l}`); e.publicationIds[l] = published.publicationId!; await store(); console.info(JSON.stringify({ phase: 'published', key: e.key, locale: l }));
    }
    for (const l of ['vi', 'en'] as const) await config(l, true);
    j.complete = true; await store();
    console.info(JSON.stringify({ status: 'PASS', entries: j.entries.length, publishedVariants: j.entries.length * 2, locales: ['vi', 'en'], slug: f.tenant.slug, reset: false }));
  } finally { check(await privateDentalGoText(LOCK) === lock, 'Seed lock changed'); await unlink(LOCK); }
}
if (import.meta.main) void main().catch(async error => { await writeFile(`.local/dental-go-seed-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }), { flag: 'wx', mode: 0o600 }); console.error('Dental GO+ seed stopped; private diagnostic retained.'); process.exitCode = 1; });
