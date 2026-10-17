import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { LACVAN_SPECIFICATIONS, lacVanContent, lacVanPresentation, type LacVanContentContext } from './lacvan-content';
import { lacVanEntryOperationKeys, lacVanHash, lacVanHomeOrder, planLacVanCatalog, validateLacVanCatalog, type LacVanCatalog } from './lacvan-catalog';
import type { LacVanFixtures } from './lacvan-fixtures';
import type { BuilderContent, M4Content, M4Locale, M4NavigationNode, M4Variant } from '../apps/api/src/contracts/m4';

const fixture: LacVanFixtures = { owner: 'GCMS-LACVAN-001-v1', runId: randomUUID(), status: 'complete', createdAt: '2026-10-17T00:00:00.000Z', tenant: { id: randomUUID(), slug: 'lac-van', name: 'Nha khoa Lạc Vân' }, identities: (['Platform', 'Owner', 'Peer'] as const).map(label => ({ label, userId: randomUUID(), name: label, email: 'unused@local.example.test', password: 'not-used-by-pure-checks' })) };
const source = JSON.parse(await readFile(new URL('../docs/evidence/lacvan/assets.json', import.meta.url), 'utf8')) as { assets: { id: string; alt: { vi: string; en: string } }[] };
function plan() { return planLacVanCatalog(fixture, lacVanHash([]), new Date('2026-10-17T00:00:00.000Z')); }
function context(j = plan()): LacVanContentContext {
  return { entries: j.entries.map(e => ({ ...e, id: e.id ?? randomUUID(), publicationIds: { vi: randomUUID(), en: randomUUID() } })), assets: source.assets.map(a => ({ key: a.id, id: randomUUID(), revision: 1, processed: true, alt: a.alt })), legacyServicePublicationId: randomUUID(), promotionDates: j.promotionDates };
}
function invalid(change: (j: LacVanCatalog) => void) { const j = plan(); change(j); expect(() => validateLacVanCatalog(j, fixture)).toThrow(); }
/** Conservative pure model of 0039 admit_refs/walk_budget with 0060 carousel assets.
 * Count every raw pin twice, retain repeated nested uses and render JSONB-style spaces.
 * This is source-level budget evidence. Actual PostgreSQL admission remains a root check. */
function budget(c: LacVanContentContext, locale: M4Locale) {
  const docs = new Map(c.entries.map(e => [e.id!, lacVanContent(c, e, locale)]));
  const root = docs.get(c.entries.find(e => e.key === 'home')!.id!) as BuilderContent;
  function jsonb(v: unknown): string { if (Array.isArray(v)) return '[' + v.map(jsonb).join(', ') + ']'; if (v && typeof v === 'object') return '{' + Object.entries(v).map(([key, value]) => JSON.stringify(key) + ': ' + jsonb(value)).join(', ') + '}'; return JSON.stringify(v); }
  const bytesOf = (v: unknown) => new TextEncoder().encode(jsonb(v)).byteLength;
  function refs(doc: M4Content): { id: string }[] {
    if ('sections' in doc) return doc.sections.filter(s => !s.hidden).flatMap(s => 'references' in s ? s.references : s.type === 'promotion' ? [s.reference] : s.type === 'consultation' ? [...s.serviceOptions, ...s.locationOptions, ...(s.promotion ? [s.promotion] : [])] : []);
    return 'contentLinks' in doc ? doc.contentLinks?.references ?? [] : 'references' in doc ? doc.references : [];
  }
  function assets(doc: M4Content): number { if ('sections' in doc) return doc.sections.reduce((n, s) => n + (s.type === 'hero' ? Number(!!s.image) : s.type === 'hero_carousel' ? s.slides.filter(s => s.image).length : 0), 0); if ('pairs' in doc) return doc.pairs.length * 2; if ('image' in doc) return Number(!!doc.image); if ('coverImage' in doc) return Number(!!doc.coverImage); return 0; }
  let nodes = 0, depth = 0, bytes = bytesOf(root) * 2 + 16_384 + assets(root) * 8192 + bytesOf(lacVanPresentation(c, locale, true));
  function walk(references: { id: string }[], level = 0) { depth = Math.max(depth, level); for (const ref of references) { const doc = docs.get(ref.id); if (!doc) throw new Error('Unbudgeted reference'); nodes++; bytes += bytesOf(doc) + 4096 + assets(doc) * 8192; const nested = refs(doc); if (nested.length) walk(nested, level + 1); } }
  walk([...refs(root), ...refs(root)]); return { locale, nodes, depth, bytes };
}
function repairScenario() {
  const j = plan(), c = context(j), item = j.entries.find(e => e.key === 'home')!, desired = lacVanContent(c, c.entries.find(e => e.key === 'home')!, 'vi') as BuilderContent;
  const original = structuredClone(desired); original.sections.push({ id: 'v1-faq', type: 'faq', hidden: false, title: 'Questions', references: [], required: true });
  const configPin = { version: 1, publicationVersion: 1, publicationRevision: 1, publicationId: randomUUID(), contentHash: lacVanHash({}), configPublicationId: null }; j.configs.vi.bootstrap = configPin;
  const saveBody = { operationId: item.id!, content: original }, publishId = randomUUID(), publishBody = { operationId: publishId, expectedVersion: 1, expectedPublicationVersion: 0, expectedPublicationRevision: 0, expectedConfigPublicationId: configPin.publicationId };
  const path = `/api/tenants/${j.tenantId}/site-builder/resources/home/${item.id}/vi`;
  j.operations['save-home-vi'] = { id: item.id!, path: `/api/tenants/${j.tenantId}/site-builder/resources/home?locale=vi`, method: 'POST', body: saveBody, bodyHash: lacVanHash(saveBody), intentHash: lacVanHash(original), receipt: 'command', attempted: true, completed: true, resultHash: lacVanHash({ id: item.id, kind: 'home', locale: 'vi', version: 1, publicationId: null, content: original }) };
  j.operations['publish-home-vi'] = { id: publishId, path: path + '/publish', method: 'POST', body: publishBody, bodyHash: lacVanHash(publishBody), intentHash: lacVanHash({ content: original, id: item.id, locale: 'vi' }), receipt: 'command', attempted: true, completed: false, resultHash: null };
  const current: M4Variant = { id: item.id!, tenantId: j.tenantId, kind: 'home', locale: 'vi', version: 1, publicationVersion: 0, publicationRevision: 0, publishedVersion: null, activePublication: false, publicationId: null, slugLocked: false, updatedAt: '2026-10-17T00:00:00.000Z', content: original, legacy: false };
  return { j, c, item, desired, current, path };
}
describe('Lac Van pure content and ownership', () => {
  test('plans only this owned tenant and refuses another run, actor, duplicate ID or changed specification', () => {
    const j = plan(); expect(() => validateLacVanCatalog(j, fixture)).not.toThrow();
    invalid(j => { j.tenantId = randomUUID(); }); invalid(j => { j.fixtureRun = randomUUID(); }); invalid(j => { j.actorId = randomUUID(); }); invalid(j => { j.entries[1].id = j.entries[0].id; }); invalid(j => { j.entries[0].slug = 'other'; });
    expect(j.entries.filter(e => e.kind === 'doctor')).toHaveLength(8); expect(j.entries.filter(e => e.kind === 'service')).toHaveLength(6); expect(j.entries.filter(e => e.kind === 'location')).toHaveLength(3);
  });
  test('all authored VI and EN records parse with real contract validators', () => {
    const c = context();
    for (const e of c.entries) for (const locale of ['vi', 'en'] as const) {
      const value = lacVanContent(c, e, locale); expect(value).toBeDefined();
      const rendered = JSON.stringify(value); expect(rendered).not.toMatch(/lorem ipsum|\bdemo\b|\bfixture\b|minh họa M4|Synthetic|elitedental/i);
      if ('title' in value) expect(value.title.length).toBeGreaterThan(4);
      if ('kind' in value && value.kind === 'location') { expect(value.phone).toBe(''); expect(value.email).toBe(''); expect(value.mapUrl).toBe(''); expect(value.openingHours).toHaveLength(7); }
    }
    for (const locale of ['vi', 'en'] as const) { const articleBodies = c.entries.filter(e => e.kind === 'article').map(e => { const value = lacVanContent(c, e, locale); return 'body' in value ? JSON.stringify(value.body) : ''; }); expect(new Set(articleBodies).size).toBe(13); }
  });
  test('first home publication order satisfies every pin and action target before use', () => {
    const j = plan(), populated = context(j), c: LacVanContentContext = { ...populated, entries: populated.entries.map(e => ({ ...e, publicationIds: {} })) };
    const order = lacVanHomeOrder(j.entries); expect(order.at(-1)?.key).toBe('home'); expect(new Set(order.map(e => e.key)).size).toBe(order.length);
    const published = new Set<string>();
    function actions(value: unknown) { if (!value || typeof value !== 'object') return; if ('target' in value) { const t = value.target as { id: string }; expect(published.has(t.id)).toBe(true); } for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(actions); else if (child && typeof child === 'object') actions(child); }
    for (const planned of order) { const e = c.entries.find(e => e.key === planned.key)!; for (const locale of ['vi', 'en'] as const) { const value = lacVanContent(c, e, locale); actions(value); e.publicationIds[locale] = randomUUID(); } published.add(e.id!); }
    expect(order.length).toBe(LACVAN_SPECIFICATIONS.filter(s => s.phase === 'home').length);
  });
  test('legacy prices use the owned eligible legacy service pin before M4 adoption', () => {
    const c = context(), e = c.entries.find(e => e.key === 'price-preventive')!, value = lacVanContent(c, e, 'vi', true);
    expect('references' in value && value.references).toEqual([{ kind: 'service', id: c.entries.find(e => e.key === 'service-implant')!.id!, publicationId: c.legacyServicePublicationId! }]);
    c.legacyServicePublicationId = null; expect(() => lacVanContent(c, e, 'vi', true)).toThrow();
  });
  test('navigation and contact come from publications and remain within depth and count limits', () => {
    const c = context();
    for (const locale of ['vi', 'en'] as const) { const config = lacVanPresentation(c, locale, true); let count = 0, maximumDepth = 0; const targets = new Set<string>(); function visit(nodes: M4NavigationNode[], depth = 1) { for (const n of nodes) { count++; maximumDepth = Math.max(maximumDepth, depth); expect(depth).toBeLessThanOrEqual(3); if (n.type === 'resource') targets.add(n.target.id); if (n.children.length) visit(n.children, depth + 1); } } visit(config.signature!.navigation); expect(count).toBeLessThanOrEqual(60); expect(maximumDepth).toBe(3); expect(config.signature!.footerLocations).toHaveLength(3); expect(config.signature!.headerLocation).toEqual(config.signature!.footerLocations[0]); expect(config.logo).toBeNull(); for (const e of c.entries.filter(e => e.kind === 'page' || e.kind === 'landing')) expect(targets.has(e.id!)).toBe(true); }
    const home = lacVanContent(c, c.entries.find(e => e.key === 'home')!, 'vi'); expect('sections' in home && home.sections[0].type).toBe('hero_carousel');
    c.entries.find(e => e.key === 'location-an-nhien')!.publicationIds.vi = undefined; expect(() => lacVanPresentation(c, 'vi', true)).toThrow();
  });
  test('media and publication failures cannot produce a fallback success', () => {
    const c = context(), e = c.entries.find(e => e.key === 'doctor-minh-an')!;
    c.assets.find(a => a.key === 'doctor-minh-an')!.processed = false; expect(() => lacVanContent(c, e, 'en')).toThrow();
    const c2 = context(); c2.entries.find(e => e.key === 'specialty-implant')!.publicationIds.vi = undefined; expect(() => lacVanContent(c2, c2.entries.find(e => e.key === 'service-implant')!, 'vi')).toThrow();
  });
  test('journal rejects changed bodies and commands outside exact owned targets', () => {
    const j = plan(), id = randomUUID(), body = { operationId: id, expectedVersion: 0, content: {} };
    j.operations.probe = { id, path: `/api/tenants/${fixture.tenant.id}/site-builder/config/vi`, method: 'PUT', body, bodyHash: lacVanHash(body), intentHash: lacVanHash({}), receipt: 'command', attempted: false, completed: false, resultHash: null };
    expect(() => validateLacVanCatalog(j, fixture)).not.toThrow();
    const changed = structuredClone(j); changed.operations.probe.body.expectedVersion = 1; expect(() => validateLacVanCatalog(changed, fixture)).toThrow();
    const foreign = structuredClone(j); foreign.operations.probe.path = `/api/tenants/${randomUUID()}/site-builder/config/vi`; expect(() => validateLacVanCatalog(foreign, fixture)).toThrow();
    const unowned = structuredClone(j); unowned.operations.probe.path = `/api/tenants/${fixture.tenant.id}/site-builder/resources/home/${randomUUID()}/vi`; expect(() => validateLacVanCatalog(unowned, fixture)).toThrow();
  });
  test('bounded home keeps the reference families with SQL-weighted graph headroom', () => {
    const c = context();
    for (const locale of ['vi', 'en'] as const) {
      const home = lacVanContent(c, c.entries.find(e => e.key === 'home')!, locale) as BuilderContent;
      const count = (type: string) => { const s = home.sections.find(s => s.type === type); return s && 'references' in s ? s.references.length : 0; };
      expect(count('services')).toBe(6); expect(count('doctors')).toBe(4); expect(count('cases')).toBe(0); expect(count('testimonials')).toBe(2); expect(count('gallery')).toBe(1); expect(count('articles')).toBe(2);
      expect(home.sections.some(s => ['prices', 'locations', 'faq', 'promotion'].includes(s.type))).toBe(false);
      const form = home.sections.find(s => s.type === 'consultation')!; expect(form.type === 'consultation' && form.serviceOptions).toEqual([]); expect(form.type === 'consultation' && form.locationOptions.length).toBe(3);
      const articleSection = home.sections.find(s => s.type === 'articles')!; expect(articleSection.type === 'articles' && articleSection.references.some(r => r.id === c.entries.find(e => e.key === 'article-khong-gian-lang-nghe')!.id)).toBe(true);
      const result = budget(c, locale); console.info('Lac Van pure admit_refs estimate', JSON.stringify(result)); expect(result.nodes).toBeLessThan(200); expect(result.depth).toBeLessThanOrEqual(3); expect(result.bytes).toBeLessThan(850_000);
    }
    expect(c.entries).toHaveLength(71); expect(c.entries.filter(e => e.kind === 'doctor')).toHaveLength(8);
  });
  test('v2 repair preserves v1 operation bytes and refuses changed or already-published baselines', () => {
    const s = repairScenario(), original = JSON.stringify(s.j.operations), specifications = s.j.specificationHash;
    expect(() => validateLacVanCatalog(s.j, fixture)).not.toThrow();
    expect(lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, s.current)).toEqual({ save: 'save-home-bounded-v2-vi', publish: 'publish-home-bounded-v2-vi', repair: true });
    expect(JSON.stringify(s.j.operations)).toBe(original); expect(s.j.specificationHash).toBe(specifications); expect(s.j.entries).toHaveLength(71);
    const wrongVersion = { ...s.current, version: 2 }; expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, wrongVersion)).toThrow();
    expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, { ...s.current, content: s.desired })).toThrow();
    expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, { ...s.current, activePublication: true, publicationId: randomUUID() })).toThrow();
    expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, { ...s.current, tenantId: randomUUID() })).toThrow();
    const changed = structuredClone(s.j); changed.operations['publish-home-vi'].body.expectedVersion = 2; expect(() => lacVanEntryOperationKeys(changed, s.item, 'vi', s.desired, s.current)).toThrow();
    const completed = structuredClone(s.j); completed.operations['publish-home-vi'].completed = true; expect(() => lacVanEntryOperationKeys(completed, s.item, 'vi', s.desired, s.current)).toThrow();
  });
  test('v2 save and publish retry only their exact journaled expected versions', () => {
    const s = repairScenario(), saveId = randomUUID(), body = { operationId: saveId, expectedVersion: 1, content: s.desired };
    s.j.operations['save-home-bounded-v2-vi'] = { id: saveId, path: s.path, method: 'PUT', body, bodyHash: lacVanHash(body), intentHash: lacVanHash(s.desired), receipt: 'command', attempted: true, completed: false, resultHash: null };
    const saved = { ...s.current, version: 2, content: s.desired };
    expect(lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, saved).repair).toBe(true);
    const publishId = randomUUID(), publishBody = { ...s.j.operations['publish-home-vi'].body, operationId: publishId, expectedVersion: 2 };
    s.j.operations['publish-home-bounded-v2-vi'] = { id: publishId, path: s.path + '/publish', method: 'POST', body: publishBody, bodyHash: lacVanHash(publishBody), intentHash: lacVanHash({ content: s.desired, id: s.item.id, locale: 'vi' }), receipt: 'command', attempted: true, completed: false, resultHash: null };
    const published = { ...saved, activePublication: true, publicationId: randomUUID(), publicationVersion: 1, publicationRevision: 1, publishedVersion: 2 };
    expect(lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, published).repair).toBe(true);
    expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, { ...saved, version: 3 })).toThrow();
    s.j.operations['publish-home-bounded-v2-vi'].body.expectedVersion = 1; expect(() => lacVanEntryOperationKeys(s.j, s.item, 'vi', s.desired, saved)).toThrow();
  });
});
