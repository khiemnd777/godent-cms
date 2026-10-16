import type { M5EntryContext } from "../../api/src/contracts/m5-domains";
import { entryReadHeaders } from "./public-entry";
import { parseSlug } from "../../api/src/contracts/content";
import { M4_LIMITS, M4_ROUTES, type M4Kind, type M4Locale, type M4Resolution } from "../../api/src/contracts/m4";
import { parseM4Kind, parseM4Locale } from "../../api/src/contracts/m4-validation";
import { exactObject } from "../../api/src/contracts/content";
import { parsePublicBuilderConfig, parsePublicBuilderList, parsePublicBuilderResolution, parsePublicBuilderSeo } from "./public-builder-validation";
export { parsePublicBuilderResolution } from "./public-builder-validation";

async function anonymousRead(path: string, timeout = 5_000, context?: M5EntryContext): Promise<unknown | null> {
  const response = await fetch(`http://127.0.0.1:5890${path}`, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(Math.max(1, timeout)), headers: { Accept: "application/json", ...entryReadHeaders(context) } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public content is temporarily unavailable");
  const text = await response.text(); if (new TextEncoder().encode(text).byteLength > M4_LIMITS.publicBytes) throw new Error("Public publication is too large");
  try { return JSON.parse(text); }
  catch { throw new Error("Invalid public publication"); }
}
export async function readPublicBuilderPage(tenant: string, locale: M4Locale, kind: M4Kind, slug: string, context?: M5EntryContext): Promise<M4Resolution | null> {
  try { parseSlug(tenant); parseM4Locale(locale); parseM4Kind(kind); parseSlug(slug); } catch { return null; }
  const value = await anonymousRead(M4_ROUTES.publicPage(tenant, locale, kind, slug), 5_000, context); if (value === null) return null;
  try { return parsePublicBuilderResolution(value, tenant, locale, kind, slug, context?.primary); } catch { throw new Error("Invalid public publication"); }
}
export type BuilderListQuery = Pick<import("../../api/src/contracts/m3").ContentListQuery, "q" | "cursor" | "referenceKind" | "referenceId" | "referencePublicationId">;
export function builderListSearch(query: BuilderListQuery): string { const params = new URLSearchParams(); if (query.q) params.set("q", query.q); if (query.cursor) params.set("cursor", query.cursor); if (query.referenceKind && query.referenceId) { params.set("referenceKind", query.referenceKind); params.set("referenceId", query.referenceId); if (query.referencePublicationId) params.set("referencePublicationId", query.referencePublicationId); } return params.size ? `?${params}` : ""; }
export async function readPublicBuilderList(tenant: string, locale: M4Locale, kind: M4Kind, query: BuilderListQuery = {}, context?: M5EntryContext) {
  try { parseSlug(tenant); parseM4Locale(locale); parseM4Kind(kind); } catch { return null; }
  const value = await anonymousRead(M4_ROUTES.publicList(tenant, locale, kind) + builderListSearch(query), 5_000, context); if (value === null) return null;
  try { return parsePublicBuilderList(value, tenant, locale, kind, context?.primary); } catch { throw new Error("Invalid public publication"); }
}
export async function readPublicBuilderConfig(tenant: string, locale: M4Locale, context?: M5EntryContext) {
  try { parseSlug(tenant); parseM4Locale(locale); } catch { return null; }
  const value = await anonymousRead(M4_ROUTES.publicConfig(tenant, locale), 5_000, context); if (value === null) return null;
  try { return parsePublicBuilderConfig(value, tenant, locale, context?.primary); } catch { throw new Error("Invalid public presentation"); }
}
/** Paginated source reads have one overall deadline. An incomplete sitemap is an error. */
export async function readPublicBuilderSeo(tenant: string, context?: M5EntryContext) {
  try { parseSlug(tenant); } catch { return null; }
  const deadline = Date.now() + 5_000, entries: unknown[] = [], seen = new Set<string>(); let cursor: string | null = null;
  do {
    if (Date.now() >= deadline) throw new Error("SEO read deadline exceeded");
    const value = await anonymousRead(M4_ROUTES.seo(tenant) + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""), deadline - Date.now(), context); if (value === null) return null;
    const page = exactObject(value, ["items", "nextCursor"]);
    if (!Array.isArray(page.items) || page.items.length > 50 || entries.length + page.items.length > 10_000 || (page.nextCursor !== null && (typeof page.nextCursor !== "string" || page.nextCursor.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(page.nextCursor)))) throw new Error("Invalid SEO page");
    entries.push(...page.items); cursor = page.nextCursor as string | null;
    if (cursor) { if (seen.has(cursor)) throw new Error("Repeated SEO cursor"); seen.add(cursor); }
  } while (cursor);
  return parsePublicBuilderSeo(entries, tenant, context?.primary);
}
