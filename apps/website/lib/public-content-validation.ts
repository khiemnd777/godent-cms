import { boundedText, exactObject, parseRichText, parseSlug } from "../../api/src/contracts/content";
import { contentPublicPath, M3_KINDS, M3_LIMITS, M3_REFERENCE_RULES, type ContentKind, type ContentPublicMedia, type ContentReference, type DentalContent, type PublicContentCard, type PublicContentList, type PublicContentPage, type PublicServiceContentLinks, type ReferenceKind, type ResolvedContentReference } from "../../api/src/contracts/m3";
import { parseContentPrice, parseContentReferences, parseDentalContent } from "../../api/src/contracts/m3-validation";
import { PUBLIC_SITE_ORIGIN, type PublicServicePage } from "../../api/src/contracts/s03";
import type { ServiceMediaReference } from "../../api/src/contracts/s07";

const referenceKinds: readonly string[] = [...M3_KINDS, "service"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function uuid(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) throw new Error("Invalid identifier"); return value; }
function positive(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("Invalid version"); return value; }
function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error("Invalid list"); return value; }
function kind(value: unknown): ReferenceKind { if (typeof value !== "string" || !referenceKinds.includes(value)) throw new Error("Invalid content kind"); return value as ReferenceKind; }
function reference(value: unknown): ContentReference { const v = exactObject(value, ["kind", "id", "publicationId"]); return { kind: kind(v.kind), id: uuid(v.id), publicationId: uuid(v.publicationId) }; }
function image(value: unknown): ServiceMediaReference | null {
  if (value === null) return null;
  const v = exactObject(value, ["assetId", "revision", "alt"]);
  return { assetId: uuid(v.assetId), revision: positive(v.revision), alt: boundedText(v.alt, 500, true) };
}
export const parsePublicPrice = parseContentPrice;
/** A published gallery can retain no complete pair after current-permission pruning. */
function content(value: unknown): DentalContent {
  if ((value as { kind?: unknown } | null)?.kind !== "gallery") return parseDentalContent(value);
  const v = exactObject(value, ["kind", "slug", "title", "summary", "body", "seo", "references", "pairs"]);
  const pairs = array(v.pairs, M3_LIMITS.pairs);
  if (pairs.length) return parseDentalContent(value);
  const seo = exactObject(v.seo, ["title", "description"]);
  const references = parseContentReferences(v.references);
  if (references.some(ref => !M3_REFERENCE_RULES.gallery.includes(ref.kind))) throw new Error("Invalid gallery reference");
  return { kind: "gallery", slug: parseSlug(v.slug), title: boundedText(v.title, 160, true), summary: boundedText(v.summary, 320), body: parseRichText(v.body), seo: { title: boundedText(seo.title, 160), description: boundedText(seo.description, 320) }, references, pairs: [] };
}
function site(value: unknown): PublicServicePage["site"] {
  const v = exactObject(value, ["name", "footer"]), footer = exactObject(v.footer, ["intro", "body"]);
  return { name: boundedText(v.name, 160, true), footer: { intro: boundedText(footer.intro, 500), body: parseRichText(footer.body, 2000) } };
}
function canonical(value: unknown, tenant: string, referenceKind: ReferenceKind, slug?: string): string {
  const expected = PUBLIC_SITE_ORIGIN + contentPublicPath(tenant, referenceKind, slug);
  if (value !== expected) throw new Error("Invalid canonical URL"); return expected;
}
function publicMedia(value: unknown, resourceId: string, publicationId: string): ContentPublicMedia[] {
  return array(value, M3_LIMITS.pairs * 2 + 1).map(raw => {
    const v = exactObject(raw, ["slot", "pairIndex", "caption", "media"]), m = exactObject(v.media, ["assetId", "revision", "alt", "width", "height", "path", "profile"]);
    const ref = image({ assetId: m.assetId, revision: m.revision, alt: m.alt })!;
    const width = positive(m.width), height = positive(m.height);
    const parts = typeof m.path === "string" ? m.path.split("/") : [];
    if (m.profile !== "cover" || width > 1600 || height > 1600 || parts.length !== 10 || parts.slice(0, 4).join("/") !== "/api/public/content-media" || !UUID.test(parts[4]) || parts[5] !== resourceId || parts[6] !== publicationId || parts[7] !== ref.assetId || parts[8] !== String(ref.revision) || parts[9] !== "cover") throw new Error("Invalid public media gateway");
    if (v.pairIndex !== undefined && (typeof v.pairIndex !== "number" || !Number.isInteger(v.pairIndex) || v.pairIndex < 0 || v.pairIndex >= M3_LIMITS.pairs)) throw new Error("Invalid gallery index");
    return { slot: boundedText(v.slot, 80, true), ...(v.pairIndex === undefined ? {} : { pairIndex: v.pairIndex }), ...(v.caption === undefined ? {} : { caption: boundedText(v.caption, 1000) }), media: { ...ref, width, height, path: String(m.path), profile: "cover" } };
  });
}
function validateClosure(body: DentalContent, references: ResolvedContentReference[], media: ContentPublicMedia[]) {
  if (body.references.length !== references.length || body.references.some((pin, index) => {
    const ref = references[index]; return pin.kind !== ref.kind || pin.id !== ref.id || pin.publicationId !== ref.publicationId;
  })) throw new Error("Invalid public reference closure");
  for (const item of media) {
    let ref: ServiceMediaReference | null = null;
    if (body.kind === "gallery") {
      const pair = item.pairIndex === undefined ? undefined : body.pairs[item.pairIndex];
      const side = pair && (item.slot === "before" ? pair.before : item.slot === "after" ? pair.after : undefined);
      if (!side || item.caption !== side.caption) throw new Error("Invalid public gallery closure"); ref = side;
    } else if ("image" in body && item.slot === "image" && item.pairIndex === undefined) ref = body.image;
    if (!ref || ref.assetId !== item.media.assetId || ref.revision !== item.media.revision || ref.alt !== item.media.alt) throw new Error("Invalid public image closure");
  }
}
function resolved(value: unknown, tenant: string, depth = 0, budget = { count: 0 }): ResolvedContentReference[] {
  const entries = array(value, M3_LIMITS.references);
  if (depth >= M3_LIMITS.publicDepth && entries.length) throw new Error("Public reference graph too deep");
  return entries.map(raw => {
    if (++budget.count > M3_LIMITS.publicNodes) throw new Error("Public reference graph too large");
    const v = exactObject(raw, ["kind", "id", "publicationId", "title", "slug", "path", "publicationVersion", "content", "references", "media"]);
    const ref = reference({ kind: v.kind, id: v.id, publicationId: v.publicationId }), slug = parseSlug(v.slug), title = boundedText(v.title, 160, true);
    if (v.path !== contentPublicPath(tenant, ref.kind, slug)) throw new Error("Invalid public path");
    let body: ResolvedContentReference["content"];
    if (ref.kind === "service") { const s = exactObject(v.content, ["kind", "title", "slug", "summary"]); if (s.kind !== "service" || s.slug !== slug || s.title !== title) throw new Error("Invalid service reference"); body = { kind: "service", title, slug, summary: boundedText(s.summary, 320) }; }
    else { body = content(v.content); if (body.kind !== ref.kind || body.slug !== slug || body.title !== title) throw new Error("Invalid resolved identity"); }
    const references = resolved(v.references, tenant, depth + 1, budget), media = publicMedia(v.media, ref.id, ref.publicationId);
    if (body.kind !== "service") validateClosure(body, references, media);
    else if (references.length || media.length) throw new Error("Invalid service reference closure");
    return { ...ref, slug, title, path: String(v.path), publicationVersion: positive(v.publicationVersion), content: body, references, media };
  });
}
export function parsePublicContentPage(value: unknown, tenant: string, expectedKind: ContentKind, slug: string): PublicContentPage {
  const v = exactObject(value, ["schemaVersion", "locale", "id", "kind", "publicationId", "publicationVersion", "publishedAt", "canonicalUrl", "site", "content", "references", "media"]);
  const id = uuid(v.id), publicationId = uuid(v.publicationId), body = content(v.content);
  if (v.schemaVersion !== 3 || v.locale !== "vi" || v.kind !== expectedKind || body.kind !== expectedKind || body.slug !== slug || typeof v.publishedAt !== "string" || !Number.isFinite(Date.parse(v.publishedAt))) throw new Error("Invalid public identity");
  const references = resolved(v.references, tenant), media = publicMedia(v.media, id, publicationId); validateClosure(body, references, media);
  return { schemaVersion: 3, locale: "vi", id, kind: expectedKind, publicationId, publicationVersion: positive(v.publicationVersion), publishedAt: v.publishedAt, canonicalUrl: canonical(v.canonicalUrl, tenant, expectedKind, slug), site: site(v.site), content: body, references, media };
}
export function parsePublicContentList(value: unknown, tenant: string, expectedKind: ReferenceKind): PublicContentList {
  const v = exactObject(value, ["schemaVersion", "locale", "kind", "canonicalUrl", "site", "items", "nextCursor"]);
  if (v.schemaVersion !== 3 || v.locale !== "vi" || v.kind !== expectedKind) throw new Error("Invalid public list identity");
  const items: PublicContentCard[] = array(v.items, M3_LIMITS.maxPageSize).map(raw => {
    const c = exactObject(raw, ["id", "kind", "title", "slug", "summary", "path", "publicationId", "publicationVersion", "price", "inclusions", "notes", "locations", "answer"]), slug = parseSlug(c.slug);
    if (c.kind !== expectedKind || c.path !== contentPublicPath(tenant, expectedKind, slug)) throw new Error("Invalid public card identity");
    if ((expectedKind !== "price" && [c.price, c.inclusions, c.notes, c.locations].some(value => value !== undefined)) || (c.answer !== undefined && expectedKind !== "faq")) throw new Error("Invalid public card fields");
    const price = expectedKind === "price" ? parsePublicPrice(c.price) : undefined;
    const locations = c.locations === undefined ? undefined : array(c.locations, M3_LIMITS.references).map(raw => {
      const l = exactObject(raw, ["title", "path"]), path = boundedText(l.path, 300, true), prefix = contentPublicPath(tenant, "location") + "/";
      if (!path.startsWith(prefix) || path !== contentPublicPath(tenant, "location", parseSlug(path.slice(prefix.length)))) throw new Error("Invalid location path");
      return { title: boundedText(l.title, 160, true), path };
    });
    return { id: uuid(c.id), kind: expectedKind, title: boundedText(c.title, 160, true), slug, summary: boundedText(c.summary, 320), path: String(c.path), publicationId: uuid(c.publicationId), publicationVersion: positive(c.publicationVersion), ...(price ? { price } : {}), ...(c.inclusions === undefined ? {} : { inclusions: boundedText(c.inclusions, 2000) }), ...(c.notes === undefined ? {} : { notes: boundedText(c.notes, 2000) }), ...(locations === undefined ? {} : { locations }), ...(c.answer === undefined ? {} : { answer: parseRichText(c.answer) }) };
  });
  return { schemaVersion: 3, locale: "vi", kind: expectedKind, canonicalUrl: canonical(v.canonicalUrl, tenant, expectedKind), site: site(v.site), items, nextCursor: v.nextCursor === null ? null : boundedText(v.nextCursor, 4096, true) };
}
export function parsePublicServiceLinks(value: unknown, tenant: string): PublicServiceContentLinks {
  const v = exactObject(value, ["serviceId", "publicationId", "references", "locations"]);
  const serviceId = uuid(v.serviceId), publicationId = uuid(v.publicationId);
  const references = resolved(v.references, tenant);
  const locations = array(v.locations, M3_LIMITS.references).map(raw => {
    const l = exactObject(raw, ["id", "publicationId", "name", "address"]), id = uuid(l.id), publicationId = uuid(l.publicationId);
    const ref = references.find(ref => ref.kind === "location" && ref.id === id && ref.publicationId === publicationId);
    if (!ref || ref.title !== l.name || ref.content.kind !== "location" || ref.content.address !== l.address) throw new Error("Invalid service location");
    return { id, publicationId, name: boundedText(l.name, 160, true), address: boundedText(l.address, 1000, true) };
  });
  return { serviceId, publicationId, references, locations };
}
