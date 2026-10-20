import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { DENTAL_GO_SPEC, dentalGoContent, dentalGoPresentation, type DentalGoContext } from './dental-go-content';
import type { BuilderContent, SitePresentation } from '../apps/api/src/contracts/m4';

function context(): DentalGoContext {
  return { entries: DENTAL_GO_SPEC.map(s => ({ ...s, id: randomUUID(), legacyCreated: true, publicationIds: { vi: randomUUID(), en: randomUUID() } })), assets: ['logo-primary', 'logo-mark', 'hero-smile', 'clinic-reception', 'clinic-treatment-room', 'doctor-mai-anh', 'doctor-minh-khang', 'service-preventive', 'service-orthodontic', 'service-restorative'].map(key => ({ key, id: randomUUID(), revision: 1, alt: { vi: 'Ảnh gốc riêng của Dental GO+', en: 'Original Dental GO+ image' } })), legacyServicePublicationId: randomUUID() };
}
test('every VI/EN page uses only the new clinic and existing CMS contracts', () => {
  const c = context();
  for (const locale of ['vi', 'en'] as const) for (const e of c.entries) {
    const content = dentalGoContent(c, e, locale), text = JSON.stringify(content);
    expect(text).not.toMatch(/Lạc Vân|Lac Van|lac-van|Elite Dental|Dental Go Plus/);
    expect(content).toHaveProperty('slug', e.slug);
    if (e.kind === 'price') { expect(content).toHaveProperty('price.currency', 'VND'); expect(content).toHaveProperty('price.unit', locale === 'en' ? e.key === 'price-general' ? 'visit' : e.key === 'price-ortho' ? 'plan' : 'tooth' : e.key === 'price-general' ? 'lần' : e.key === 'price-ortho' ? 'kế hoạch' : 'răng'); }
  }
});
test('home has one deliberate hero, no automatic rotation and a tenant-scoped consultation', () => {
  const c = context(), home = dentalGoContent(c, c.entries.find(e => e.key === 'home')!, 'vi') as BuilderContent;
  expect(home.sections.length).toBeLessThanOrEqual(30);
  expect(home.sections[0]).toMatchObject({ type: 'hero_carousel', autoplay: false });
  const forms = home.sections.filter(s => s.type === 'consultation'); expect(forms).toHaveLength(1);
  expect(forms[0]).toHaveProperty('serviceOptions');
  expect(JSON.stringify(home)).not.toContain('requestKey');
});
test('a missing image or published dependency stops seeding instead of using old-clinic fallback', () => {
  const c = context(), home = c.entries.find(e => e.key === 'home')!;
  c.assets = c.assets.filter(a => a.key !== 'hero-smile'); expect(() => dentalGoContent(c, home, 'vi')).toThrow('Missing ready image');
  const d = context(); d.entries.find(e => e.key === 'location')!.publicationIds.en = undefined;
  expect(() => dentalGoContent(d, d.entries.find(e => e.key === 'service-general')!, 'en')).toThrow('Missing published dependency');
});
test('both presentations keep the exact Dental GO+ wordmark, supported theme and owned logo', () => {
  const c = context();
  for (const locale of ['vi', 'en'] as const) {
    const p: SitePresentation = dentalGoPresentation(c, locale, true);
    expect(p.name).toBe('Dental GO+'); expect(p.theme).toBe('signature'); expect(p.palette).toBe('teal');
    expect(p.logo?.assetId).toBe(c.assets.find(a => a.key === 'logo-mark')!.id);
    expect(p.signature?.navigation).toHaveLength(7);
    expect(p.signature?.footerLocations[0].publicationId).toBe(c.entries.find(e => e.key === 'location')!.publicationIds[locale]!);
  }
});
