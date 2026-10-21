import { describe, expect, test } from 'bun:test';
import type { BuilderContent, HeroCarouselSection, M4Variant, SitePresentation } from '../apps/api/src/contracts/m4';
import { desiredHeroContent, expectedPublicContent, fixedConfigPin, resolvedSlidesMatch } from './hero-typography-local';
import { createHash } from 'node:crypto';

const titles = {
  'dental-go-plus': {
    vi: ['Nụ cười tự nhiên. Khởi đầu từ sự thấu hiểu.'],
    en: ['Natural smiles. Care begins with understanding.'],
  },
  'lac-van': {
    vi: ['An tâm cho từng nụ cười', 'An tâm từ sự thấu hiểu', 'Dành thời gian cho chính bạn'],
    en: ['Care for every smile', 'Confidence begins with understanding', 'Make time for yourself'],
  },
} as const;
const phrases = {
  'dental-go-plus': { vi: ['sự thấu hiểu.'], en: ['understanding.'] },
  'lac-van': { vi: ['nụ cười', 'sự thấu hiểu', 'chính bạn'], en: ['every smile', 'understanding', 'yourself'] },
} as const;

function homeVariant(site: keyof typeof titles, locale: 'vi' | 'en'): M4Variant {
  const hero: HeroCarouselSection = { id: 'hero', type: 'hero_carousel', hidden: false, autoplay: false, intervalMs: 7000, slides: titles[site][locale].map((title, index) => ({ id: `slide-${index}`, title, text: `Supporting ${index}`, image: null, action: null })) };
  const content: BuilderContent = { kind: 'home', slug: 'home', title: 'Untouched title', summary: 'Untouched summary', seo: { title: 'Untouched SEO', description: 'Untouched description' }, sections: [hero, { id: 'services', type: 'services', hidden: false, title: 'Services', references: [], required: false }] };
  return { id: 'home-id', tenantId: 'tenant-id', kind: 'home', locale, version: 4, publicationVersion: 2, publicationRevision: 2, publishedVersion: 4, activePublication: true, publicationId: 'publication-id', slugLocked: true, updatedAt: '2026-10-20T00:00:00.000Z', content, legacy: false };
}
function configVariant(locale: 'vi' | 'en'): M4Variant {
  const content = { name: 'Untouched clinic', theme: 'signature', themeVersion: 1, palette: 'plum', font: 'serif', layout: 'comfortable', logo: null, footer: { intro: 'Keep', body: { schemaVersion: 1, blocks: [] } }, menu: [], signature: { navigation: [], headerLocation: null, footerLocations: [] } } as unknown as SitePresentation;
  return { ...homeVariant('lac-van', locale), id: 'tenant-id', kind: 'config', content };
}

describe('local Hero publication intent', () => {
  for (const site of ['dental-go-plus', 'lac-van'] as const) for (const locale of ['vi', 'en'] as const) {
    test(`${site} ${locale} changes only the selected slide phrases`, () => {
      const original = homeVariant(site, locale), before = structuredClone(original.content) as BuilderContent;
      const desired = desiredHeroContent(`${site}:${locale}:home`, original) as BuilderContent;
      const slides = (desired.sections[0] as HeroCarouselSection).slides;
      expect(slides.map(slide => slide.highlight)).toEqual([...phrases[site][locale]]);
      expect(slides.map(slide => { const copy = { ...slide }; delete copy.highlight; return copy; })).toEqual((before.sections[0] as HeroCarouselSection).slides);
      expect({ ...desired, sections: [before.sections[0], ...desired.sections.slice(1)] }).toEqual(before);
      expect(original.content).toEqual(before);
    });
    test(`${site} ${locale} changes only Signature typography style`, () => {
      const original = configVariant(locale), before = structuredClone(original.content) as SitePresentation;
      const desired = desiredHeroContent(`${site}:${locale}:config`, original) as SitePresentation;
      expect(desired.signature?.heroTypography).toBe(site === 'dental-go-plus' ? 'warm_editorial' : 'rose_editorial');
      const stripped = structuredClone(desired); delete stripped.signature!.heroTypography;
      expect(stripped).toEqual(before);
      expect(original.content).toEqual(before);
    });
  }
  test('rejects changed slide count, missing phrase and repeated phrase', () => {
    const count = homeVariant('lac-van', 'vi'), missing = homeVariant('lac-van', 'vi'), repeated = homeVariant('lac-van', 'vi');
    ((count.content as BuilderContent).sections[0] as HeroCarouselSection).slides.pop();
    ((missing.content as BuilderContent).sections[0] as HeroCarouselSection).slides[0].title = 'A different heading';
    ((repeated.content as BuilderContent).sections[0] as HeroCarouselSection).slides[0].title = 'nụ cười và nụ cười';
    expect(() => desiredHeroContent('lac-van:vi:home', count)).toThrow('HOME_SLIDE_COUNT_CHANGED');
    expect(() => desiredHeroContent('lac-van:vi:home', missing)).toThrow('HIGHLIGHT_NOT_EXACT_UNIQUE_TITLE_SUBSTRING');
    expect(() => desiredHeroContent('lac-van:vi:home', repeated)).toThrow('HIGHLIGHT_NOT_EXACT_UNIQUE_TITLE_SUBSTRING');
  });
  test('pins each home publication to the original config head and rejects a concurrent config publication', () => {
    const original = configVariant('vi');
    const baseline = { tenantId: original.tenantId, variant: original } as Parameters<typeof fixedConfigPin>[1];
    const saved = { ...original, version: original.version + 1, publicationId: original.publicationId };
    expect(fixedConfigPin(saved, baseline)).toBe(original.publicationId!);
    expect(() => fixedConfigPin({ ...saved, publicationId: 'another-publication' }, baseline)).toThrow('CONFIG_PUBLICATION_PIN_CHANGED');
    expect(() => fixedConfigPin({ ...saved, tenantId: 'another-tenant' }, baseline)).toThrow('CONFIG_PUBLICATION_PIN_CHANGED');
  });
  test('public readback intent preserves the original projection except one approved phrase', () => {
    const variant = homeVariant('dental-go-plus', 'en'), publicContent = structuredClone(variant.content) as BuilderContent;
    const canonical = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
      if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
      return JSON.stringify(value);
    };
    const digest = createHash('sha256').update(canonical(publicContent)).digest('hex');
    const baseline = { variant, publicContentHash: digest } as Parameters<typeof expectedPublicContent>[1];
    const desired = expectedPublicContent('dental-go-plus:en:home', baseline, publicContent) as BuilderContent;
    expect((desired.sections[0] as HeroCarouselSection).slides[0].highlight).toBe('understanding.');
    expect((publicContent.sections[0] as HeroCarouselSection).slides[0].highlight).toBeUndefined();
    expect(() => expectedPublicContent('dental-go-plus:en:home', baseline, { ...publicContent, summary: 'Concurrent edit' })).toThrow('PUBLIC_BASELINE_HASH_CHANGED');
  });
  test('accepts 0060 resolved slide shape without highlight while checking slide identity and copy', () => {
    const source = homeVariant('lac-van', 'en');
    const expected = ((desiredHeroContent('lac-van:en:home', source) as BuilderContent).sections[0] as HeroCarouselSection).slides;
    const projectedBy0060 = expected.map(slide => ({ id: slide.id, title: slide.title, text: slide.text }));
    expect(resolvedSlidesMatch(projectedBy0060, expected)).toBe(true);
    expect(resolvedSlidesMatch([{ ...projectedBy0060[0], text: 'Unrelated edit' }, ...projectedBy0060.slice(1)], expected)).toBe(false);
    expect(resolvedSlidesMatch(projectedBy0060.slice(1), expected)).toBe(false);
  });
});
