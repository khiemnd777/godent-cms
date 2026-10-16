import { expect, test } from 'bun:test';
import { legacyDocument, parseServiceInput } from '../src/contracts/content';

const content = { slug: 'service', title: 'Service', summary: '', body: legacyDocument('Body'), seo: { title: '', description: '' } };
test('service cover is an opaque revision reference, never a remote object URL', () => {
  const coverImage = { assetId: 'c328e1bb-2b4f-4c05-940b-6613af031e54', revision: 1, alt: 'Synthetic image' };
  expect(parseServiceInput({ ...content, coverImage }).coverImage).toEqual(coverImage);
  expect(parseServiceInput({ ...content, coverImage: null }).coverImage).toBeNull();
  expect(parseServiceInput(content).coverImage).toBeUndefined();
});
test('service cover rejects URL imports, stale-shaped references and unbounded alt text', () => {
  for (const coverImage of [{ url: 'https://example.invalid/private.jpg' }, { assetId: 'other', revision: 1, alt: '' },
    { assetId: 'c328e1bb-2b4f-4c05-940b-6613af031e54', revision: 0, alt: '' },
    { assetId: 'c328e1bb-2b4f-4c05-940b-6613af031e54', revision: 1, alt: 'a'.repeat(501) }]) {
    expect(() => parseServiceInput({ ...content, coverImage })).toThrow();
  }
});
