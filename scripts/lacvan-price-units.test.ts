import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { DentalContent } from '../apps/api/src/contracts/m3';
import type { BuilderContent, M4Variant } from '../apps/api/src/contracts/m4';
import { LACVAN_SPECIFICATIONS, lacVanContent, lacVanDocument, lacVanPriceUnit, type LacVanContentContext } from './lacvan-content';
import { CHANGED_PRICE_UNIT_SERVICES, assertPriceUnitOperationTransition, assertPriceUnitResumeState, originalPriceUnit, priceUnitOnlyContent, replacePricePagePins, type PriceUnitOperation } from './lacvan-price-units';

const expected = { implant: ['răng', 'tooth'], orthodontics: ['kế hoạch', 'treatment plan'], restorative: ['răng', 'tooth'], preventive: ['lần', 'visit'], children: ['lần', 'visit'], wisdom: ['răng', 'tooth'] } as const;
function context(): LacVanContentContext {
  return { entries: LACVAN_SPECIFICATIONS.map(e => ({ ...e, id: randomUUID(), publicationIds: { vi: randomUUID(), en: randomUUID() } })), assets: [], legacyServicePublicationId: randomUUID(), promotionDates: { startAt: '2026-10-16T00:00:00Z', endAt: '2027-01-01T00:00:00Z' } };
}
type Price = Extract<DentalContent, { kind: 'price' }>;
function original(service = 'orthodontics', locale: 'vi' | 'en' = 'vi'): Price {
  const c = context(), e = c.entries.find(e => e.key === `price-${service}`)!, value = lacVanContent(c, e, locale);
  if (!('kind' in value) || value.kind !== 'price') throw new Error('Price required');
  return { ...value, price: { ...value.price, unit: originalPriceUnit(service, locale) } };
}
function variant(): M4Variant { return { id: randomUUID(), tenantId: randomUUID(), kind: 'price', locale: 'vi', version: 2, publicationVersion: 1, publicationRevision: 1, publishedVersion: 2, activePublication: true, publicationId: randomUUID(), slugLocked: true, updatedAt: '2026-10-17T00:00:00Z', legacy: false, content: original() }; }
describe('Lac Van price unit repair', () => {
  test('all six services use the explicit customer-facing unit in both locales', () => {
    const c = context();
    for (const [service, units] of Object.entries(expected)) for (const [index, locale] of (['vi', 'en'] as const).entries()) {
      const e = c.entries.find(e => e.key === `price-${service}`)!, content = lacVanContent(c, e, locale);
      if (!('kind' in content) || content.kind !== 'price') throw new Error('Price content required');
      expect(content.price.unit).toBe(units[index]);
    }
    expect(CHANGED_PRICE_UNIT_SERVICES).toEqual(['implant', 'orthodontics', 'restorative', 'wisdom']);
    expect(() => lacVanPriceUnit('unknown', 'vi')).toThrow();
  });
  test('changes only units in eight variants and leaves the other four price variants exact', () => {
    let changed = 0;
    for (const service of Object.keys(expected)) for (const locale of ['vi', 'en'] as const) {
      const before = original(service, locale), snapshot = structuredClone(before), after = priceUnitOnlyContent(service, locale, before);
      expect(before).toEqual(snapshot);
      expect({ ...after, price: { ...after.price, unit: before.price.unit } }).toEqual(before);
      expect(after.references).toEqual(before.references); expect(after.notes).toBe(before.notes); expect(after.inclusions).toBe(before.inclusions);
      if (['preventive', 'children'].includes(service)) expect(after).toEqual(before);
      else { changed++; expect(after.price.unit).not.toBe(before.price.unit); }
    }
    expect(changed).toBe(8);
    const altered = original(); altered.price.unit = 'A later CMS edit';
    expect(() => priceUnitOnlyContent('orthodontics', 'vi', altered)).toThrow('ORIGINAL_PRICE_UNIT_CHANGED');
  });
  test('unit replacement preserves every field of from, exact and range amounts', () => {
    const base = original();
    const prices: Price['price'][] = [{ type: 'from', amount: '28000000', currency: 'VND', unit: originalPriceUnit('orthodontics', 'vi') }, { type: 'exact', amount: '28000000', currency: 'VND', unit: originalPriceUnit('orthodontics', 'vi') }, { type: 'range', minimum: '28000000', maximum: '32000000', currency: 'VND', unit: originalPriceUnit('orthodontics', 'vi') }];
    for (const price of prices) { const before = { ...base, price }, after = priceUnitOnlyContent('orthodontics', 'vi', before); expect(after.price).toEqual({ ...price, unit: 'kế hoạch' }); expect({ ...after, price }).toEqual(before); }
  });
  test('repins four prices across grouped sections while preserving manual content and the other two pins', () => {
    const pins = Object.keys(expected).map(service => { const priorPublicationId = randomUUID(), changed = (CHANGED_PRICE_UNIT_SERVICES as readonly string[]).includes(service); return { id: randomUUID(), priorPublicationId, publicationId: changed ? randomUUID() : priorPublicationId, changed }; });
    const refs = [...pins].reverse().map(p => ({ kind: 'price' as const, id: p.id, publicationId: p.priorPublicationId }));
    const before: BuilderContent = { kind: 'page', slug: 'chi-phi-dieu-tri', title: 'Current CMS fees heading', summary: 'Keep current introduction', seo: { title: 'Current SEO', description: 'Current description' }, sections: [
      { id: 'intro', type: 'rich_text', hidden: false, body: lacVanDocument('Current CMS copy and cost explanation.') },
      { id: 'group-one', type: 'prices', hidden: false, required: true, title: 'Current group one', references: refs.slice(0, 3) },
      { id: 'group-two', type: 'prices', hidden: false, required: true, title: 'Current group two', references: refs.slice(3) },
      { id: 'form', type: 'consultation', hidden: false, title: 'Keep current form', promotion: null, serviceOptions: [], locationOptions: [] },
    ] };
    const snapshot = structuredClone(before), after = replacePricePagePins(before, pins), expectedPage = structuredClone(before);
    for (const section of expectedPage.sections) if (section.type === 'prices') for (const ref of section.references) ref.publicationId = pins.find(p => p.id === ref.id)!.publicationId;
    expect(before).toEqual(snapshot); expect(after).toEqual(expectedPage);
    expect(after.sections[0]).toEqual(before.sections[0]); expect(after.sections[3]).toEqual(before.sections[3]);
    const wrong = structuredClone(before); if (wrong.sections[1].type === 'prices') wrong.sections[1].references[0].publicationId = randomUUID();
    expect(() => replacePricePagePins(wrong, pins)).toThrow('ORIGINAL_PAGE_PRICE_PIN_CHANGED');
    const changedVisit = structuredClone(pins); changedVisit.find(p => !p.changed)!.publicationId = randomUUID();
    expect(() => replacePricePagePins(before, changedVisit)).toThrow('INVALID_PRICE_PIN_REPLACEMENTS');
    expect(() => replacePricePagePins(before, pins.slice(1))).toThrow();
  });
  test('resume accepts exact uncertain owned commands and rejects manual, stale or cross-tenant state', () => {
    const before = variant(), content = priceUnitOnlyContent('orthodontics', 'vi', before.content), saved = { ...before, content, version: before.version + 1 };
    expect(() => assertPriceUnitResumeState(before, before, null, content, false)).not.toThrow();
    expect(() => assertPriceUnitResumeState(saved, before, 'save', content, true)).not.toThrow();
    expect(() => assertPriceUnitResumeState(saved, before, 'save', content, false)).toThrow();
    const published = { ...saved, publicationId: randomUUID(), publishedVersion: saved.version, publicationVersion: before.publicationVersion + 1, publicationRevision: before.publicationRevision + 1 };
    expect(() => assertPriceUnitResumeState(published, saved, 'publish', content, true)).not.toThrow();
    expect(() => assertPriceUnitResumeState({ ...saved, content: { ...content, notes: 'A later CMS edit' } }, before, 'save', content, true)).toThrow();
    expect(() => assertPriceUnitResumeState({ ...published, publicationRevision: published.publicationRevision + 1 }, saved, 'publish', content, true)).toThrow();
    expect(() => assertPriceUnitResumeState({ ...before, tenantId: randomUUID() }, before, null, content, false)).toThrow();
  });
  test('request bodies, operation IDs and successful receipts remain frozen during resume', () => {
    const op: PriceUnitOperation = { id: randomUUID(), request: null, requestHash: null, attempted: false, reply: null, replyHash: null };
    const prepared = { ...op, request: { path: '/owned-price', method: 'PUT' as const, body: { operationId: op.id, expectedVersion: 2 } }, requestHash: 'prepared' };
    expect(() => assertPriceUnitOperationTransition(op, prepared)).not.toThrow();
    expect(() => assertPriceUnitOperationTransition(prepared, { ...prepared, request: { ...prepared.request, body: { ...prepared.request.body, expectedVersion: 3 } } })).toThrow();
    expect(() => assertPriceUnitOperationTransition(prepared, { ...prepared, id: randomUUID() })).toThrow();
    const attempted = { ...prepared, attempted: true }, complete = { ...attempted, reply: { operationId: op.id, replayed: false, draft: variant() }, replyHash: 'frozen' };
    expect(() => assertPriceUnitOperationTransition(attempted, complete)).not.toThrow();
    expect(() => assertPriceUnitOperationTransition(attempted, prepared)).toThrow();
    expect(() => assertPriceUnitOperationTransition(complete, { ...complete, reply: null, replyHash: null })).toThrow();
    expect(() => assertPriceUnitOperationTransition(complete, { ...complete, reply: { ...complete.reply, draft: { ...complete.reply.draft, version: 9 } } })).toThrow();
  });
});
