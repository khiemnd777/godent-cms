import { PUBLIC_SITE_ORIGIN, RESERVED_SLUGS, S03_LIMITS, type RichInline, type RichTextDocument, type ServiceContent } from './s03';

export function exactObject(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype ||
      Object.keys(input).some(key => !keys.includes(key))) throw new TypeError('Invalid content');
  return input as Record<string, unknown>;
}
export function boundedText(value: unknown, maximum: number, required = false): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > maximum || (required && !value.trim())) throw new TypeError('Invalid text');
  return value;
}
export function parseSlug(value: unknown): string {
  if (typeof value !== 'string' || value.length > S03_LIMITS.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
      (RESERVED_SLUGS as readonly string[]).includes(value)) throw new TypeError('Invalid slug');
  return value;
}
export function safeLink(value: unknown): string {
  const href = boundedText(value, S03_LIMITS.href, true);
  if (/[\u0000-\u0020\u007f\\]/.test(href) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(href) || !/^https?:\/\//i.test(href)) throw new TypeError('Invalid link');
  const authority=href.replace(/^https?:\/\//i,'').split(/[/?#]/,1)[0];
  if(authority.includes('@')) throw new TypeError('Invalid link');
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new TypeError('Invalid link');
  return href;
}
function parseInlines(value: unknown): RichInline[] {
  if (!Array.isArray(value) || value.length > S03_LIMITS.inlines) throw new TypeError('Invalid inlines');
  return value.map(item => {
    const entry = exactObject(item, ['type', 'text', 'href']);
    const text = boundedText(entry.text, S03_LIMITS.bodyText);
    if (entry.type === 'text' && Object.keys(entry).sort().join(',') === 'text,type') return { type: 'text', text };
    if (entry.type === 'link' && Object.keys(entry).sort().join(',') === 'href,text,type') return { type: 'link', text, href: safeLink(entry.href) };
    throw new TypeError('Invalid inline');
  });
}
export function parseRichText(input: unknown, maximum: number = S03_LIMITS.bodyText): RichTextDocument {
  const value = exactObject(input, ['type', 'version', 'blocks']);
  if (value.type !== 'doc' || value.version !== 1 || !Array.isArray(value.blocks) || value.blocks.length > S03_LIMITS.blocks) throw new TypeError('Invalid document');
  const blocks: RichTextDocument['blocks'] = value.blocks.map(item => {
    const block = exactObject(item, ['type', 'children', 'items']);
    if ((block.type === 'paragraph' || block.type === 'heading') && Object.keys(block).sort().join(',') === 'children,type') {
      return { type: block.type, children: parseInlines(block.children) };
    }
    if (block.type === 'bulletList' && Object.keys(block).sort().join(',') === 'items,type' && Array.isArray(block.items) && block.items.length <= S03_LIMITS.listItems) {
      return { type: 'bulletList', items: block.items.map(parseInlines) };
    }
    throw new TypeError('Invalid block');
  });
  const document: RichTextDocument = { type: 'doc', version: 1, blocks };
  if (richTextPlain(document).length > maximum) throw new TypeError('Document too long');
  return document;
}
/** No HTML or Markdown interpretation. Retained newlines are literal text. */
export function legacyDocument(text: string): RichTextDocument {
  return { type: 'doc', version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text }] }] };
}
export function richTextPlain(document: RichTextDocument): string {
  return document.blocks.map(block => block.type === 'bulletList' ? block.items.map(inlines => inlines.map(item => item.text).join('')).join('\n') :
    block.children.map(item => item.text).join('')).join('\n');
}
export function parseServiceInput(input: unknown): ServiceContent {
  const value = exactObject(input, ['slug', 'title', 'summary', 'body', 'seo']);
  const seo = exactObject(value.seo, ['title', 'description']);
  return { slug: parseSlug(value.slug), title: boundedText(value.title, S03_LIMITS.title, true).trim(),
    summary: boundedText(value.summary, S03_LIMITS.summary), body: parseRichText(value.body),
    seo: { title: boundedText(seo.title, S03_LIMITS.seoTitle), description: boundedText(seo.description, S03_LIMITS.seoDescription) } };
}
export function canonicalServiceUrl(tenantSlug: string, serviceSlug: string): string {
  return `${PUBLIC_SITE_ORIGIN}/${parseSlug(tenantSlug)}/dich-vu/${parseSlug(serviceSlug)}`;
}
