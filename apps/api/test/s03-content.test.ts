import { describe, expect, test } from 'bun:test';
import { canonicalServiceUrl, legacyDocument, parseRichText, parseServiceInput, parseSlug, richTextPlain } from '../src/contracts/content';

describe('S03 safe publication content', () => {
  test('legacy markup and line breaks stay literal text without changing the source', () => {
    const source = '<script>alert(1)</script>\nSecond line\n';
    expect(richTextPlain(legacyDocument(source))).toBe(source);
    expect(legacyDocument(source).blocks[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: source }] });
  });
  test('accepts bounded paragraph, H2, bullet list and validated links', () => {
    const doc = { type: 'doc', version: 1, blocks: [
      { type: 'heading', children: [{ type: 'text', text: 'Heading' }] },
      { type: 'paragraph', children: [{ type: 'link', href: 'https://example.test/path', text: 'Read' }] },
      { type: 'bulletList', items: [[{ type: 'text', text: 'One' }]] },
    ] };
    expect(richTextPlain(parseRichText(doc))).toBe('Heading\nRead\nOne');
  });
  test('rejects executable sections, unknown properties, unsafe links and oversized visible text', () => {
    for (const href of ['javascript:alert(1)', '//evil.test', 'https://user:password@example.test', 'https://@example.test',
      'https://x.test\\@evil.test', 'https://x.test/\nhi', 'https://x.test/%0ahi']) {
      expect(() => parseRichText({ type: 'doc', version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'link', href, text: 'link' }] }] })).toThrow();
    }
    expect(() => parseRichText({ type: 'doc', version: 1, html: '<b>x</b>', blocks: [] })).toThrow();
    expect(() => parseRichText({ type: 'doc', version: 1, blocks: [{ type: 'embed', src: 'x' }] })).toThrow();
    expect(() => parseRichText(legacyDocument('a'.repeat(20001)))) .toThrow();
  });
  test('validates the namespace and never constructs a canonical from untrusted bases', () => {
    for (const slug of ['Admin', 'api', '../x', 'a%2fb', 'a--', '-a', 'a_b', 'a/b', 'á']) expect(() => parseSlug(slug)).toThrow();
    expect(parseSlug('synthetic-dental')).toBe('synthetic-dental');
    expect(canonicalServiceUrl('synthetic-dental', 'cleaning')).toBe('http://localhost:5892/synthetic-dental/dich-vu/cleaning');
  });
  test('rejects unknown content references and bounds all SEO fields', () => {
    const input = { slug: 'cleaning', title: 'Cleaning', summary: '', body: legacyDocument('Safe'), seo: { title: '', description: '' } };
    expect(parseServiceInput(input)).toEqual(input);
    expect(() => parseServiceInput({ ...input, doctorId: 'unknown' })).toThrow();
    expect(() => parseServiceInput({ ...input, seo: { title: 'x'.repeat(161), description: '' } })).toThrow();
  });
});
