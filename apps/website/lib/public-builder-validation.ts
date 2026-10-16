import { boundedText, exactObject, parseRichText, parseSlug } from "../../api/src/contracts/content";
import type { ContentPublicMedia } from "../../api/src/contracts/m3";
import { M4_CONSENTS, M4_LIMITS, type BuilderContent, type BuilderSection, type M4Content, type M4FormContext, type M4Kind, type M4Locale, type M4PromotionBlock, type M4PublicConfig, type M4PublicList, type M4PublicReference, type M4PublicSection, type M4Resolution, type M4SeoEntry, type PublicM4Page } from "../../api/src/contracts/m4";
import { parseM4Content, parseM4Kind, parseM4Locale, parseSitePresentation } from "../../api/src/contracts/m4-validation";
import { m3Id, m3Version, parseContentReferences } from "../../api/src/contracts/m3-validation";
import { publicPath, scopePublicResult, type PublicUrlBase } from "./public-url-context";
import { PUBLIC_SITE_ORIGIN } from "../../api/src/contracts/s03";
import type { PublicMediaBlock, ServiceMediaReference } from "../../api/src/contracts/s07";

const pageKeys = ["schemaVersion", "id", "kind", "locale", "requestedLocale", "actualLocale", "publicationId", "publicationVersion", "publishedAt", "canonicalUrl", "configPublicationId", "config", "site", "content", "references", "media", "sections", "form", "promotionState", "alternates", "legacy"];
type Scope = { kind: M4Kind | "config"; id: string; publicationId: string; locale: M4Locale; legacy?: boolean; globalLegacyService?: boolean };
type Context = { tenant: string; locale: M4Locale; nodes: number; mediaTenant?: string; primary?: PublicUrlBase };
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum) throw new TypeError("Invalid public list"); return value; }
function flag(value: unknown): boolean { if (typeof value !== "boolean") throw new TypeError("Invalid flag"); return value; }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function same(value: unknown, expected: unknown) { if (stable(value) !== stable(expected)) throw new TypeError("Invalid publication closure"); }
function canonical(value: unknown, tenant: string, locale: M4Locale, kind: M4Kind, slug?: string, primary?: PublicUrlBase): string {
  const expected = (primary?.origin ?? PUBLIC_SITE_ORIGIN) + publicPath(tenant, locale, kind, slug, primary);
  if (value !== expected) throw new TypeError("Invalid public canonical"); return expected;
}
function path(value: unknown, tenant: string, locale: M4Locale, kind: M4Kind, slug?: string, primary?: PublicUrlBase): string {
  const expected = publicPath(tenant, locale, kind, slug, primary);
  if (value !== expected) throw new TypeError("Invalid public path"); return expected;
}
/** A menu target stores identity rather than a mutable slug. Validate its resolved route family and tenant. */
function targetPath(value: unknown, tenant: string, locale: M4Locale, kind: M4Kind, primary?: PublicUrlBase): string {
  if (kind === "home") return path(value, tenant, locale, kind, undefined, primary);
  if (typeof value !== "string") throw new TypeError("Invalid target path");
  const slug = parseSlug(value.slice(value.lastIndexOf("/") + 1));
  return path(value, tenant, locale, kind, slug, primary);
}
function publicContent(kind: M4Kind, value: unknown): M4Content {
  // The public gateway may remove all complete gallery pairs after current withdrawal.
  if (kind === "gallery" && (value as { pairs?: unknown } | null)?.pairs instanceof Array && (value as { pairs: unknown[] }).pairs.length === 0) {
    const v = exactObject(value, ["kind", "slug", "title", "summary", "body", "seo", "references", "pairs"]), seo = exactObject(v.seo, ["title", "description"]);
    if (v.kind !== kind) throw new TypeError("Invalid gallery kind");
    const references = parseContentReferences(v.references); if (references.some(ref => !["service", "doctor"].includes(ref.kind))) throw new TypeError("Invalid gallery reference");
    return { kind, slug: parseSlug(v.slug), title: boundedText(v.title, 160, true), summary: boundedText(v.summary, 320), body: parseRichText(v.body), seo: { title: boundedText(seo.title, 160), description: boundedText(seo.description, 320) }, references, pairs: [] };
  }
  return parseM4Content(kind, value);
}
function contentIdentity(content: M4Content, kind: M4Kind, slug: string) {
  if (!("slug" in content) || content.slug !== slug || (kind !== "service" && (!("kind" in content) || content.kind !== kind))) throw new TypeError("Invalid content identity");
}
function media(value: unknown, scope: Scope, reference: ServiceMediaReference, context: Context): PublicMediaBlock {
  const v = exactObject(value, ["assetId", "revision", "alt", "width", "height", "path", "profile"]);
  const parts = typeof v.path === "string" ? v.path.split("/") : [];
  const builder = parts.length === 12 && parts.slice(0, 4).join("/") === "/api/public/builder-media" && parts[5] === scope.kind && parts[6] === scope.id && parts[7] === scope.locale && parts[8] === scope.publicationId && parts[9] === reference.assetId && parts[10] === String(reference.revision) && parts[11] === "cover";
  const legacy = scope.legacy === true && scope.locale === "vi" && ((scope.globalLegacyService && scope.kind === "service" && parts.length === 8 && parts.slice(0, 4).join("/") === "/api/public/media" && parts[5] === reference.assetId && parts[6] === String(reference.revision) && parts[7] === "cover") || (parts.length === 10 && parts.slice(0, 4).join("/") === "/api/public/content-media" && parts[5] === scope.id && parts[6] === scope.publicationId && parts[7] === reference.assetId && parts[8] === String(reference.revision) && parts[9] === "cover"));
  if ((!builder && !legacy) || v.profile !== "cover") throw new TypeError("Invalid media scope");
  const tenantId = m3Id(parts[4]);
  if (context.mediaTenant && context.mediaTenant !== tenantId) throw new TypeError("Mixed media tenant"); context.mediaTenant = tenantId;
  if (scope.kind === "config" && scope.id !== tenantId) throw new TypeError("Invalid logo scope");
  same({ assetId: v.assetId, revision: v.revision, alt: v.alt }, reference);
  const width = m3Version(v.width), height = m3Version(v.height); if (width > 1600 || height > 1600) throw new TypeError("Invalid media dimensions");
  return { ...reference, width, height, path: String(v.path), profile: "cover" };
}
function config(value: unknown, publicationId: unknown, context: Context): M4PublicConfig | null {
  if (value === null) { if (publicationId !== null) throw new TypeError("Invalid config identity"); return null; }
  const v = exactObject(value, ["publicationId", "publicationVersion", "locale", "content", "menu", "logoMedia"]), content = parseSitePresentation(v.content);
  if (v.publicationId !== publicationId || v.locale !== context.locale) throw new TypeError("Invalid config identity");
  const menu = list(v.menu, M4_LIMITS.menu).map(raw => {
    const item = exactObject(raw, ["id", "label", "target", "allowViFallback", "path", "actualLocale", "fallback"]);
    const original = content.menu.find(candidate => candidate.id === item.id); if (!original) throw new TypeError("Unpinned menu target");
    same({ id: item.id, label: item.label, target: item.target, allowViFallback: item.allowViFallback }, original);
    const actualLocale = parseM4Locale(item.actualLocale), fallback = flag(item.fallback);
    if (fallback ? !(original.allowViFallback && original.target.locale === "en" && actualLocale === "vi") : original.target.locale !== actualLocale) throw new TypeError("Invalid menu locale");
    return { ...original, actualLocale, fallback, path: targetPath(item.path, context.tenant, actualLocale, original.target.kind, context.primary) };
  });
  if (new Set(menu.map(item => item.id)).size !== menu.length || menu.some((item, index) => index > 0 && content.menu.findIndex(candidate => candidate.id === menu[index - 1].id) >= content.menu.findIndex(candidate => candidate.id === item.id))) throw new TypeError("Invalid menu order");
  let logoMedia = null;
  if (content.logo !== null) {
    const raw = exactObject(v.logoMedia, ["assetId", "revision", "alt", "width", "height", "path", "profile"]), parts = typeof raw.path === "string" ? raw.path.split("/") : [];
    logoMedia = media(raw, { kind: "config", id: parts[4], publicationId: m3Id(v.publicationId), locale: context.locale }, content.logo, context);
  } else if (v.logoMedia !== null) throw new TypeError("Unpinned logo");
  return { publicationId: m3Id(v.publicationId), publicationVersion: m3Version(v.publicationVersion), locale: context.locale, content, menu, logoMedia };
}
function pins(content: M4Content): { kind: string; id: string; publicationId: string }[] {
  if ("references" in content) return content.references;
  if ("contentLinks" in content) return content.contentLinks?.references ?? [];
  if ("sections" in content) return content.sections.flatMap(section => {
    if (section.hidden) return [];
    if ("references" in section) return section.references;
    if (section.type === "promotion") return [section.reference];
    if (section.type === "consultation") return [...(section.promotion ? [section.promotion] : []), ...section.serviceOptions, ...section.locationOptions];
    return [];
  });
  return [];
}
function validatePins(selected: { kind: string; id: string; publicationId: string }[], resolved: M4PublicReference[], required = false) {
  if (new Set(resolved.map(ref => ref.kind + ":" + ref.id + ":" + ref.publicationId)).size !== resolved.length || resolved.some(ref => !selected.some(pin => pin.kind === ref.kind && pin.id === ref.id && pin.publicationId === ref.publicationId)) || (required && selected.length !== resolved.length)) throw new TypeError("Unpinned public reference");
}
function publicMedia(value: unknown, content: M4Content, scope: Scope, context: Context): ContentPublicMedia[] {
  const entries = list(value, 41).map(raw => {
    const item = exactObject(raw, ["slot", "pairIndex", "caption", "media"]); let reference: ServiceMediaReference | null = null;
    if ("kind" in content && content.kind === "gallery") {
      if (!Number.isInteger(item.pairIndex) || Number(item.pairIndex) < 0 || Number(item.pairIndex) >= content.pairs.length) throw new TypeError("Invalid gallery index");
      const pair = content.pairs[Number(item.pairIndex)], side = item.slot === "before" ? pair.before : item.slot === "after" ? pair.after : null;
      if (!side || item.caption !== side.caption) throw new TypeError("Invalid gallery caption");
      reference = { assetId: side.assetId, revision: side.revision, alt: side.alt };
    } else {
      if (item.pairIndex !== undefined || item.caption !== undefined) throw new TypeError("Invalid media fields");
      if ("image" in content && item.slot === "image") reference = content.image;
      if ("coverImage" in content && item.slot === "image") reference = content.coverImage ?? null;
    }
    if (!reference) throw new TypeError("Unpinned media");
    return { slot: boundedText(item.slot, 80, true), ...(item.pairIndex === undefined ? {} : { pairIndex: Number(item.pairIndex) }), ...(item.caption === undefined ? {} : { caption: boundedText(item.caption, 1000) }), media: media(item.media, scope, reference, context) };
  });
  if (new Set(entries.map(entry => `${entry.slot}:${entry.pairIndex ?? ""}`)).size !== entries.length) throw new TypeError("Duplicate public media");
  const expected = "pairs" in content ? content.pairs.length * 2 : "image" in content ? Number(content.image !== null) : "coverImage" in content ? Number(Boolean(content.coverImage)) : 0;
  if (entries.length !== expected) throw new TypeError("Incomplete media closure");
  return entries;
}
function references(value: unknown, context: Context, depth: number): M4PublicReference[] {
  const items = list(value, M4_LIMITS.publicNodes); if (depth > M4_LIMITS.publicDepth && items.length) throw new TypeError("Public graph too deep");
  return items.map(raw => {
    if (++context.nodes > M4_LIMITS.publicNodes) throw new TypeError("Public graph too large");
    const v = exactObject(raw, ["id", "kind", "publicationId", "publicationVersion", "locale", "title", "slug", "path", "content", "references", "media", "legacy"]);
    const kind = parseM4Kind(v.kind), id = m3Id(v.id), publicationId = m3Id(v.publicationId), slug = kind === "home" && v.slug === "home" ? "home" : parseSlug(v.slug);
    if (v.locale !== context.locale) throw new TypeError("Mixed reference locale");
    const content = publicContent(kind, v.content); contentIdentity(content, kind, slug);
    if (!("title" in content) || content.title !== v.title) throw new TypeError("Invalid reference title");
    const children = references(v.references, context, depth + 1); validatePins(pins(content), children);
    const legacy = v.legacy === undefined ? false : flag(v.legacy); if (legacy && context.locale !== "vi") throw new TypeError("Invalid legacy locale");
    return { id, kind, publicationId, publicationVersion: m3Version(v.publicationVersion), locale: context.locale, title: boundedText(v.title, 160, true), slug, path: path(v.path, context.tenant, context.locale, kind, slug, context.primary), content, references: children, media: publicMedia(v.media, content, { kind, id, publicationId, locale: context.locale, legacy }, context), ...(v.legacy === undefined ? {} : { legacy }) };
  });
}
function form(value: unknown, page: Scope & { configPublicationId: string | null }, context: Context, depth: number): M4FormContext | null {
  if (value === null) return null;
  const v = exactObject(value, ["sourceType", "sourceId", "sourcePublicationId", "sourceConfigPublicationId", "formLocale", "consent", "promotionId", "promotionPublicationId", "serviceOptions", "locationOptions"]);
  if (!["service", "landing"].includes(String(v.sourceType)) || v.sourceType !== page.kind || v.sourceId !== page.id || v.sourcePublicationId !== page.publicationId || v.sourceConfigPublicationId !== page.configPublicationId || v.formLocale !== context.locale) throw new TypeError("Invalid form source");
  same(v.consent, M4_CONSENTS[context.locale]);
  const serviceOptions = references(v.serviceOptions, context, depth + 1), locationOptions = references(v.locationOptions, context, depth + 1);
  if (serviceOptions.some(option => option.kind !== "service") || locationOptions.some(option => option.kind !== "location")) throw new TypeError("Invalid form option");
  if ((v.promotionId === null) !== (v.promotionPublicationId === null)) throw new TypeError("Invalid form promotion");
  return { sourceType: v.sourceType as "service" | "landing", sourceId: page.id, sourcePublicationId: page.publicationId, sourceConfigPublicationId: page.configPublicationId, formLocale: context.locale, consent: M4_CONSENTS[context.locale], promotionId: v.promotionId === null ? null : m3Id(v.promotionId), promotionPublicationId: v.promotionPublicationId === null ? null : m3Id(v.promotionPublicationId), serviceOptions, locationOptions };
}
function promotionBlock(value: unknown, context: Context, depth: number): M4PromotionBlock {
  if (depth > M4_LIMITS.publicDepth || ++context.nodes > M4_LIMITS.publicNodes) throw new TypeError("Public graph too large");
  const v = exactObject(value, ["id", "kind", "locale", "publicationId", "publicationVersion", "publishedAt", "canonicalUrl", "content", "references", "media", "promotionState"]);
  if (v.kind !== "promotion" || v.locale !== context.locale || typeof v.publishedAt !== "string" || !Number.isFinite(Date.parse(v.publishedAt)) || !["upcoming", "active", "expired"].includes(String(v.promotionState))) throw new TypeError("Invalid promotion block");
  const content = publicContent("promotion", v.content); if (!("kind" in content) || content.kind !== "promotion") throw new TypeError("Invalid promotion content");
  const id = m3Id(v.id), publicationId = m3Id(v.publicationId), refs = references(v.references, context, depth + 1); validatePins(content.references, refs, true);
  return { id, kind: "promotion", locale: context.locale, publicationId, publicationVersion: m3Version(v.publicationVersion), publishedAt: v.publishedAt, canonicalUrl: canonical(v.canonicalUrl, context.tenant, context.locale, "promotion", content.slug, context.primary), content, references: refs, media: publicMedia(v.media, content, { kind: "promotion", id, publicationId, locale: context.locale }, context), promotionState: v.promotionState as M4PromotionBlock["promotionState"] };
}
function sections(value: unknown, content: M4Content, scope: Scope & { configPublicationId: string | null }, context: Context, depth: number): M4PublicSection[] {
  const visible = "sections" in content ? (content as BuilderContent).sections.filter(section => !section.hidden) : [];
  const entries = list(value, M4_LIMITS.sections).map((raw, index): M4PublicSection => {
    const v = exactObject(raw, ["section", "references", "media", "promotion", "form", "action"]), section: BuilderSection | undefined = visible[index];
    if (!section) throw new TypeError("Unpinned section"); same(v.section, section);
    const refs = references(v.references, context, depth + 1);
    if ("references" in section) validatePins(section.references, refs, section.required); else if (refs.length) throw new TypeError("Unexpected section references");
    let image = null, action = null, promotion = null;
    if (section.type === "hero") {
      if (section.image) image = media(v.media, scope, section.image, context); else if (v.media !== null) throw new TypeError("Unpinned hero image");
      if (v.action !== null) {
        if (!section.action) throw new TypeError("Unpinned hero action");
        const a = exactObject(v.action, ["label", "path", "actualLocale", "fallback"]), actualLocale = parseM4Locale(a.actualLocale), fallback = flag(a.fallback);
        if (a.label !== section.action.label || (fallback ? !(section.action.allowViFallback && section.action.target.locale === "en" && actualLocale === "vi") : section.action.target.locale !== actualLocale)) throw new TypeError("Invalid hero action");
        action = { label: section.action.label, path: targetPath(a.path, context.tenant, actualLocale, section.action.target.kind, context.primary), actualLocale, fallback };
      }
    } else if (v.media !== null || v.action !== null) throw new TypeError("Unexpected section media/action");
    if (section.type === "promotion" || section.type === "consultation") {
      const selected = section.type === "promotion" ? section.reference : section.promotion;
      if (v.promotion !== null) { promotion = promotionBlock(v.promotion, context, depth + 1); if (!selected || promotion.id !== selected.id || promotion.publicationId !== selected.publicationId) throw new TypeError("Unpinned promotion"); }
      else if (section.type === "promotion" && section.required) throw new TypeError("Missing required promotion");
    } else if (v.promotion !== null) throw new TypeError("Unexpected promotion");
    const resolvedForm = form(v.form, scope, context, depth);
    if (section.type !== "consultation" && resolvedForm !== null) throw new TypeError("Unexpected form");
    if (section.type === "consultation" && resolvedForm) {
      validatePins(section.serviceOptions, resolvedForm.serviceOptions); validatePins(section.locationOptions, resolvedForm.locationOptions);
      if (section.promotion ? resolvedForm.promotionId !== section.promotion.id || resolvedForm.promotionPublicationId !== section.promotion.publicationId : resolvedForm.promotionId !== null) throw new TypeError("Unpinned form promotion");
    }
    return { section, references: refs, media: image, action, promotion, form: resolvedForm };
  });
  if (entries.length !== visible.length) throw new TypeError("Incomplete sections"); return entries;
}
function publicPage(value: unknown, context: Context, kind: M4Kind, slug?: string, depth = 0): PublicM4Page {
  if (depth > M4_LIMITS.publicDepth || ++context.nodes > M4_LIMITS.publicNodes) throw new TypeError("Public graph too large");
  const v = exactObject(value, pageKeys);
  if (v.schemaVersion !== 4 || v.kind !== kind || v.locale !== context.locale || v.actualLocale !== context.locale || v.requestedLocale !== context.locale || typeof v.publishedAt !== "string" || !Number.isFinite(Date.parse(v.publishedAt))) throw new TypeError("Invalid public identity");
  const content = publicContent(kind, v.content), actualSlug = "slug" in content ? content.slug : ""; contentIdentity(content, kind, slug ?? actualSlug);
  const presentation = config(v.config, v.configPublicationId, context), id = m3Id(v.id), publicationId = m3Id(v.publicationId);
  const site = exactObject(v.site, ["name", "footer"]), footer = exactObject(site.footer, ["intro", "body"]);
  const parsedSite = { name: boundedText(site.name, 160, true), footer: { intro: boundedText(footer.intro, 500), body: parseRichText(footer.body, 2000) } };
  if (presentation) same(parsedSite, { name: presentation.content.name, footer: presentation.content.footer });
  const legacy = flag(v.legacy); if (legacy && context.locale !== "vi") throw new TypeError("Invalid legacy locale");
  const scope = { kind, id, publicationId, locale: context.locale, configPublicationId: presentation?.publicationId ?? null, legacy, globalLegacyService: kind === "service" && legacy };
  const refs = references(v.references, context, depth + 1); validatePins(pins(content), refs);
  const projectedSections = sections(v.sections, content, scope, context, depth), resolvedForm = form(v.form, scope, context, depth);
  if (kind === "landing") same(resolvedForm, projectedSections.find(item => item.section.type === "consultation")?.form ?? null);
  else if (kind !== "service" && resolvedForm !== null) throw new TypeError("Unexpected page form");
  if (kind === "promotion" ? !["upcoming", "active", "expired"].includes(String(v.promotionState)) : v.promotionState !== null) throw new TypeError("Invalid promotion state");
  const alternates = list(v.alternates, 2).map(raw => { const a = exactObject(raw, ["locale", "url", "publicationId"]), locale = parseM4Locale(a.locale); return { locale, url: canonical(a.url, context.tenant, locale, kind, actualSlug, context.primary), publicationId: m3Id(a.publicationId) }; });
  if (new Set(alternates.map(item => item.locale)).size !== alternates.length || !alternates.some(item => item.locale === context.locale && item.publicationId === publicationId)) throw new TypeError("Invalid alternates");
  return { schemaVersion: 4, id, kind, locale: context.locale, requestedLocale: context.locale, actualLocale: context.locale, publicationId, publicationVersion: m3Version(v.publicationVersion), publishedAt: v.publishedAt, canonicalUrl: canonical(v.canonicalUrl, context.tenant, context.locale, kind, actualSlug, context.primary), configPublicationId: scope.configPublicationId, config: presentation, site: parsedSite, content, references: refs, media: publicMedia(v.media, content, scope, context), sections: projectedSections, form: resolvedForm, promotionState: v.promotionState as PublicM4Page["promotionState"], alternates, legacy: flag(v.legacy) };
}
export function parsePublicBuilderResolution(value: unknown, tenant: string, locale: M4Locale, kind: M4Kind, slug: string, primary?: PublicUrlBase): M4Resolution {
  parseSlug(tenant); parseM4Locale(locale); parseM4Kind(kind); parseSlug(slug);
  const v = exactObject(value, ["resolution", "requestedLocale", "actualLocale", "canonicalUrl", "fallbackPublicationId", "page"]);
  if (v.requestedLocale !== locale) throw new TypeError("Invalid requested locale");
  if (v.resolution === "fallback") {
    if (locale !== "en" || v.actualLocale !== "vi" || v.page !== null) throw new TypeError("Invalid fallback");
    return { resolution: "fallback", requestedLocale: "en", actualLocale: "vi", canonicalUrl: canonical(v.canonicalUrl, tenant, "vi", kind, slug, primary), fallbackPublicationId: m3Id(v.fallbackPublicationId), page: null };
  }
  if (v.resolution !== "page" || v.actualLocale !== locale || v.fallbackPublicationId !== null) throw new TypeError("Invalid resolution");
  const page = publicPage(v.page, { tenant, locale, nodes: 0, primary }, kind, slug); same(v.canonicalUrl, page.canonicalUrl);
  return { resolution: "page", requestedLocale: locale, actualLocale: locale, canonicalUrl: page.canonicalUrl, fallbackPublicationId: null, page: scopePublicResult(page, primary) };
}
export function parsePublicBuilderList(value: unknown, tenant: string, locale: M4Locale, kind: M4Kind, primary?: PublicUrlBase): M4PublicList {
  const v = exactObject(value, ["schemaVersion", "locale", "kind", "items", "nextCursor", "config", "canonicalUrl"]);
  if (v.schemaVersion !== 4 || v.locale !== locale || v.kind !== kind) throw new TypeError("Invalid list identity");
  const context = { tenant, locale, nodes: 0, primary }, rawConfig = v.config === null ? null : exactObject(v.config, ["publicationId", "publicationVersion", "locale", "content", "menu", "logoMedia"]);
  const items = list(v.items, M4_LIMITS.maxPageSize).map(raw => {
    const item = exactObject(raw, ["id", "kind", "locale", "publicationId", "publicationVersion", "title", "slug", "content", "path", "legacy", "media", "references", "promotionState"]), slug = parseSlug(item.slug);
    if (item.kind !== kind || item.locale !== locale) throw new TypeError("Invalid list item locale");
    const content = publicContent(kind, item.content); contentIdentity(content, kind, slug); if (!("title" in content) || item.title !== content.title) throw new TypeError("Invalid item title");
    const legacy = flag(item.legacy); if (legacy && locale !== "vi") throw new TypeError("Invalid legacy locale");
    const id = m3Id(item.id), publicationId = m3Id(item.publicationId), refs = references(item.references, context, 1); validatePins(pins(content), refs);
    if (kind === "promotion" ? !["upcoming", "active", "expired"].includes(String(item.promotionState)) : item.promotionState !== null) throw new TypeError("Invalid list promotion state");
    return { id, kind, locale, publicationId, publicationVersion: m3Version(item.publicationVersion), title: boundedText(item.title, 160, true), slug, content, path: path(item.path, tenant, locale, kind, slug, primary), legacy, references: refs, media: publicMedia(item.media, content, { kind, id, publicationId, locale, legacy, globalLegacyService: kind === "service" && legacy }, context), promotionState: item.promotionState as "upcoming" | "active" | "expired" | null };
  });
  return scopePublicResult({ schemaVersion: 4 as const, locale, kind, items, nextCursor: v.nextCursor === null ? null : boundedText(v.nextCursor, 8192, true), config: config(v.config, rawConfig?.publicationId ?? null, context), canonicalUrl: canonical(v.canonicalUrl, tenant, locale, kind, undefined, primary) }, primary);
}
export function parsePublicBuilderSeo(value: unknown, tenant: string, primary?: PublicUrlBase): M4SeoEntry[] {
  const entries = list(value, 10_000).map(raw => {
    const v = exactObject(raw, ["kind", "id", "locale", "path", "canonicalUrl", "publicationId", "configPublicationId", "alternates"]), kind = parseM4Kind(v.kind), locale = parseM4Locale(v.locale);
    const route = targetPath(v.path, tenant, locale, kind, primary), url = (primary?.origin ?? PUBLIC_SITE_ORIGIN) + route;
    if (v.canonicalUrl !== url) throw new TypeError("Invalid SEO canonical");
    const alternates = list(v.alternates, 2).map(raw => { const a = exactObject(raw, ["locale", "url", "publicationId"]), l = parseM4Locale(a.locale); if (typeof a.url !== "string" || new URL(a.url).origin !== (primary?.origin ?? PUBLIC_SITE_ORIGIN)) throw new TypeError("Invalid alternate URL"); targetPath(new URL(a.url).pathname, tenant, l, kind, primary); if (new URL(a.url).search || new URL(a.url).hash) throw new TypeError("Invalid alternate query"); return { locale: l, url: a.url, publicationId: m3Id(a.publicationId) }; });
    return { kind, id: m3Id(v.id), locale, path: route, canonicalUrl: url, publicationId: m3Id(v.publicationId), configPublicationId: v.configPublicationId === null ? null : m3Id(v.configPublicationId), alternates };
  });
  if (new Set(entries.map(entry => entry.canonicalUrl)).size !== entries.length) throw new TypeError("Duplicate canonical route");
  for (const entry of entries) {
    if (new Set(entry.alternates.map(alternate => alternate.locale)).size !== entry.alternates.length || !entry.alternates.some(alternate => alternate.locale === entry.locale && alternate.url === entry.canonicalUrl && alternate.publicationId === entry.publicationId)) throw new TypeError("Invalid self alternate");
    for (const alternate of entry.alternates) {
      const sibling = entries.find(candidate => candidate.kind === entry.kind && candidate.id === entry.id && candidate.locale === alternate.locale && candidate.canonicalUrl === alternate.url && candidate.publicationId === alternate.publicationId);
      if (!sibling || !sibling.alternates.some(back => back.locale === entry.locale && back.url === entry.canonicalUrl && back.publicationId === entry.publicationId)) throw new TypeError("Missing reciprocal alternate");
    }
  }
  return entries;
}
export function parsePublicBuilderConfig(value: unknown, tenant: string, locale: M4Locale, primary?: PublicUrlBase): M4PublicConfig {
  const v = exactObject(value, ["publicationId", "publicationVersion", "locale", "content", "menu", "logoMedia"]);
  const parsed = config(value, v.publicationId, { tenant, locale, nodes: 0, primary }); if (!parsed) throw new TypeError("Missing presentation"); return parsed;
}
