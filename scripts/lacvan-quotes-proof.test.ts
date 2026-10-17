import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { BuilderContent, M4Variant } from '../apps/api/src/contracts/m4';
import { LACVAN_TESTIMONIAL_QUOTES, lacVanDocument, lacVanTestimonialQuote } from './lacvan-content';
import { assertQuoteOperationTransition, assertQuoteResumeState, expectedPublicQuoteContent, quoteOnlyContent, quoteRefreshScopes, replaceHomeQuotePins, originalQuote, type QuoteOperation } from './lacvan-quotes-proof';

function variant(locale: 'vi' | 'en' = 'vi'): M4Variant {
  return { id: randomUUID(), tenantId: randomUUID(), kind: 'testimonial', locale, version: 2, publicationVersion: 1, publicationRevision: 1, publishedVersion: 2, activePublication: true, publicationId: randomUUID(), slugLocked: true, updatedAt: '2026-10-17T00:00:00Z', legacy: false,
    content: { kind: 'testimonial', slug: 'loi-chia-se-mai-phuong', title: 'A conversation', summary: 'An illustrative perspective', seo: { title: 'A conversation', description: 'An illustrative perspective' }, body: lacVanDocument('Original fictional perspective.'), references: [], displayName: 'Mai Phuong', attribution: 'An illustrative perspective', quote: originalQuote(locale), image: { assetId: randomUUID(), revision: 1, alt: 'Original fictional portrait' } } };
}
function operation(): QuoteOperation { return { id: randomUUID(), request: null, requestHash: null, attempted: false, reply: null, replyHash: null }; }
describe('Lac Van quote refresh pure guards', () => {
  test('expects the public carousel envelope without erasing CMS content or unrelated changes', () => {
    const source: BuilderContent = { kind: 'home', slug: 'home', title: 'Manual title', summary: 'Manual summary', seo: { title: 'Manual SEO', description: 'Manual description' }, sections: [
      { id: 'welcome', type: 'hero_carousel', hidden: false, autoplay: true, intervalMs: 7000, slides: [{ id: 'first', title: 'Preserve title', text: 'Preserve text', image: { assetId: randomUUID(), revision: 1, alt: 'Original clinic' }, action: { label: 'Read', target: { kind: 'page', id: randomUUID(), locale: 'vi' }, allowViFallback: false } }] },
      { id: 'contact', type: 'consultation', hidden: false, title: 'Keep this form', promotion: null, serviceOptions: [], locationOptions: [] },
    ] };
    const snapshot = structuredClone(source), expected = structuredClone(source);
    if (expected.sections[0].type === 'hero_carousel') { expected.sections[0].slides[0].image = null; expected.sections[0].slides[0].action = null; }
    expect(expectedPublicQuoteContent(source)).toEqual(expected);
    expect(source).toEqual(snapshot);
    expect(expectedPublicQuoteContent({ ...source, title: 'Unexpected edit' })).not.toEqual(expected);
    const testimonial = variant().content;
    expect(expectedPublicQuoteContent(testimonial)).toEqual(testimonial);
  });
  test('four coherent perspectives have distinct VI and EN copy and reject unknown people', () => {
    const people = Object.keys(LACVAN_TESTIMONIAL_QUOTES);
    expect(people).toHaveLength(4);
    for (const locale of ['vi', 'en'] as const) {
      const quotes = people.map(p => lacVanTestimonialQuote(p, locale));
      expect(new Set(quotes).size).toBe(4);
      for (const q of quotes) { expect(q.length).toBeGreaterThan(90); expect(q).not.toBe(originalQuote(locale)); expect(q).not.toMatch(/cam kết|khỏi bệnh|kết quả điều trị|guarantee|cured|treatment result/i); }
    }
    expect(() => lacVanTestimonialQuote('someone-else', 'vi')).toThrow();
  });
  test('changes only the exact original quote and retains the portrait and every other content field', () => {
    for (const locale of ['vi', 'en'] as const) {
      const before = variant(locale).content;
      if (!('kind' in before) || before.kind !== 'testimonial') throw new Error('Testimonial required');
      const snapshot = structuredClone(before);
      const after = quoteOnlyContent('mai-phuong', locale, before);
      expect(after.quote).toBe(lacVanTestimonialQuote('mai-phuong', locale));
      expect({ ...after, quote: originalQuote(locale) }).toEqual(before);
      expect(before).toEqual(snapshot);
      expect(quoteRefreshScopes(after)).toEqual([{ type: 'text' }, { type: 'asset', assetId: before.image!.assetId, assetRevision: before.image!.revision, usage: 'page' }]);
      expect(() => quoteOnlyContent('mai-phuong', locale, { ...before, quote: 'An editor changed this quote.' } as typeof before)).toThrow('ORIGINAL_QUOTE_CHANGED');
      expect(() => quoteOnlyContent('mai-phuong', locale, { ...before, image: null } as typeof before)).toThrow('ORIGINAL_PORTRAIT_REQUIRED');
    }
  });
  test('replaces exactly two existing pins while preserving a manual banner, order, forms and all other fields', () => {
    const pins = [0, 1, 2, 3].map(() => ({ id: randomUUID(), priorPublicationId: randomUUID(), publicationId: randomUUID() }));
    const before: BuilderContent = { kind: 'home', slug: 'home', title: 'An tâm từ sự thấu hiểu — CMS edit', summary: 'Manual summary', seo: { title: 'Manual SEO', description: 'Manual description' }, sections: [
      { id: 'welcome', type: 'hero_carousel', hidden: false, autoplay: true, intervalMs: 7000, slides: [{ id: 'manual', title: 'An tâm từ sự thấu hiểu', text: 'Keep this exact banner', image: null, action: null }] },
      { id: 'stories', type: 'testimonials', hidden: false, title: 'Manual heading', required: true, references: [pins[1], pins[0]].map(p => ({ kind: 'testimonial', id: p.id, publicationId: p.priorPublicationId })) },
      { id: 'contact', type: 'consultation', hidden: false, title: 'Contact', promotion: null, serviceOptions: [], locationOptions: [] },
    ] };
    const snapshot = structuredClone(before), after = replaceHomeQuotePins(before, pins);
    expect(before).toEqual(snapshot);
    expect(after.sections[0]).toEqual(before.sections[0]); expect(after.sections[2]).toEqual(before.sections[2]);
    const expected = structuredClone(before); if (expected.sections[1].type === 'testimonials') expected.sections[1].references.forEach(r => { r.publicationId = pins.find(p => p.id === r.id)!.publicationId; });
    expect(after).toEqual(expected);
    const edited = structuredClone(before); if (edited.sections[1].type === 'testimonials') edited.sections[1].references[0].publicationId = randomUUID();
    expect(() => replaceHomeQuotePins(edited, pins)).toThrow('HOME_ORIGINAL_QUOTE_PIN_CHANGED');
    const extra = structuredClone(before); if (extra.sections[1].type === 'testimonials') extra.sections[1].references.push({ kind: 'testimonial', id: pins[2].id, publicationId: pins[2].priorPublicationId });
    expect(() => replaceHomeQuotePins(extra, pins)).toThrow('EXACT_TWO_HOME_QUOTES_REQUIRED');
  });
  test('recovery admits only the baseline or the exact uncertain owned save or publish', () => {
    const before = variant(), content = quoteOnlyContent('mai-phuong', 'vi', before.content);
    const saved = { ...before, content, version: before.version + 1 };
    expect(() => assertQuoteResumeState(before, before, null, content, false)).not.toThrow();
    expect(() => assertQuoteResumeState(saved, before, 'save', content, true)).not.toThrow();
    expect(() => assertQuoteResumeState(saved, before, 'save', content, false)).toThrow();
    const published = { ...saved, publicationId: randomUUID(), publishedVersion: saved.version, publicationVersion: before.publicationVersion + 1, publicationRevision: before.publicationRevision + 1 };
    expect(() => assertQuoteResumeState(published, saved, 'publish', content, true)).not.toThrow();
    expect(() => assertQuoteResumeState({ ...saved, content: { ...content, quote: 'A later manual edit' } }, before, 'save', content, true)).toThrow();
    expect(() => assertQuoteResumeState({ ...published, publicationRevision: published.publicationRevision + 1 }, saved, 'publish', content, true)).toThrow();
    expect(() => assertQuoteResumeState({ ...before, tenantId: randomUUID() }, before, null, content, false)).toThrow();
  });
  test('persisted requests and successful receipts cannot be replaced or reset', () => {
    const planned = operation(), prepared = { ...planned, request: { path: '/owned', method: 'PUT' as const, body: { operationId: planned.id, expectedVersion: 2 } }, requestHash: 'prepared' };
    expect(() => assertQuoteOperationTransition(planned, prepared)).not.toThrow();
    expect(() => assertQuoteOperationTransition(prepared, { ...prepared, request: { ...prepared.request, body: { ...prepared.request.body, expectedVersion: 3 } } })).toThrow();
    const attempted = { ...prepared, attempted: true };
    expect(() => assertQuoteOperationTransition(attempted, { ...prepared })).toThrow();
    const reply = { operationId: planned.id, replayed: false, draft: variant() }, complete = { ...attempted, reply, replyHash: 'frozen' };
    expect(() => assertQuoteOperationTransition(attempted, complete)).not.toThrow();
    expect(() => assertQuoteOperationTransition(complete, { ...complete, reply: { ...reply, draft: { ...reply.draft, version: 99 } } })).toThrow();
    expect(() => assertQuoteOperationTransition(complete, { ...complete, reply: null, replyHash: null })).toThrow();
  });
});
