import { parseSlug } from "../../api/src/contracts/content";
import { M3_PATHS } from "../../api/src/contracts/m3";
import { m4PublicPath, type M4Kind, type M4Locale } from "../../api/src/contracts/m4";
import type { PublicSearchParams } from "./public-content";
import { PUBLIC_KINDS } from "./public-content";
import type { ReferenceKind } from "../../api/src/contracts/m3";
import type { BuilderListQuery } from "./public-builder";

export const BUILDER_LABELS: Record<M4Locale, Record<M4Kind, string>> = {
  vi: { home: "Trang chủ", page: "Trang", landing: "Trang tư vấn", promotion: "Khuyến mãi", service: "Dịch vụ", specialty: "Chuyên khoa", service_group: "Nhóm dịch vụ", location: "Cơ sở", doctor: "Bác sĩ", price: "Bảng giá", case: "Ca điều trị", gallery: "Trước và sau", testimonial: "Đánh giá", article: "Bài viết", category: "Chuyên mục", faq: "Hỏi đáp" },
  en: { home: "Home", page: "Pages", landing: "Consultation pages", promotion: "Promotions", service: "Services", specialty: "Specialties", service_group: "Service groups", location: "Locations", doctor: "Doctors", price: "Prices", case: "Treatment cases", gallery: "Before and after", testimonial: "Testimonials", article: "Articles", category: "Categories", faq: "Questions and answers" },
};
export function builderKind(section: string): M4Kind | null { if (section === "landing") return "landing"; if (section === "khuyen-mai") return "promotion"; return Object.entries(M3_PATHS).find(([, path]) => path === section)?.[0] as M4Kind | undefined ?? null; }
export type BuilderRoute = { tenant: string; locale: M4Locale; kind: M4Kind; slug?: string };
export function parseBuilderRoute(pathname: string): BuilderRoute | null {
  try {
    const parts = pathname.split("/").slice(1); if (parts.some(part => !part || decodeURIComponent(part) !== part)) return null;
    const tenant = parseSlug(parts.shift()), locale = parts[0] === "en" ? (parts.shift(), "en" as const) : "vi";
    if (!parts.length) return { tenant, locale, kind: "home", slug: "home" };
    const section = parts[0], kind = builderKind(section); if (!kind) parseSlug(section);
    if (parts.length === 1) return kind ? { tenant, locale, kind } : { tenant, locale, kind: "page", slug: section };
    if (parts.length === 2 && kind) return { tenant, locale, kind, slug: parseSlug(parts[1]) };
    return null;
  } catch { return null; }
}
export class InvalidBuilderQuery extends Error { constructor() { super("Invalid public filter"); } }
export function parseBuilderQuery(params: PublicSearchParams): BuilderListQuery {
  const q = params.q, cursor = params.cursor, pageSize = params.pageSize, referenceKind = params.referenceKind, referenceId = params.referenceId, referencePublicationId = params.referencePublicationId;
  if ([q, cursor, pageSize, referenceKind, referenceId, referencePublicationId].some(Array.isArray) || (pageSize !== undefined && (typeof pageSize !== "string" || !/^[1-9]\d?$/.test(pageSize) || Number(pageSize) > 50)) || (typeof q === "string" && (q.length > 160 || /[\u0000-\u001f\u007f]/.test(q))) || (typeof cursor === "string" && (cursor.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(cursor)))) throw new InvalidBuilderQuery();
  const filter = referenceKind || referenceId || referencePublicationId, validId = (value: unknown) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  if (filter && (!PUBLIC_KINDS.includes(referenceKind as ReferenceKind) || !validId(referenceId) || (referencePublicationId !== undefined && !validId(referencePublicationId)))) throw new InvalidBuilderQuery();
  const search = typeof q === "string" ? q.normalize("NFC").trim() : "";
  return { ...(search ? { q: search } : {}), ...(typeof cursor === "string" && cursor ? { cursor } : {}), ...(typeof pageSize === "string" ? { pageSize: Number(pageSize) } : {}), ...(filter ? { referenceKind: referenceKind as ReferenceKind, referenceId: referenceId as string, ...(referencePublicationId === undefined ? {} : { referencePublicationId: referencePublicationId as string }) } : {}) };
}
export function safeTracking(params: URLSearchParams): { campaign?: string; medium?: string; source?: string } {
  const result: { campaign?: string; medium?: string; source?: string } = {};
  for (const key of ["campaign", "medium", "source"] as const) { const values = params.getAll(`utm_${key}`); if (values.length === 1 && /^[A-Za-z0-9_-]{1,64}$/.test(values[0])) result[key] = values[0]; }
  return result;
}
export function fallbackLocation(canonical: string, params: URLSearchParams, route: BuilderRoute): string {
  const url = new URL(canonical);
  for (const [key, value] of Object.entries(safeTracking(params))) url.searchParams.set(`utm_${key}`, value);
  // Cursors bind a locale and filter. Changing locale starts at the first page and retains only search text.
  if (!route.slug) { const query = parseBuilderQuery(Object.fromEntries([...params.keys()].map(key => [key, params.getAll(key).length > 1 ? params.getAll(key) : params.get(key)!]))); if (query.q) url.searchParams.set("q", query.q); if (query.pageSize) url.searchParams.set("pageSize", String(query.pageSize)); if (query.referenceKind && query.referenceId) { url.searchParams.set("referenceKind", query.referenceKind); url.searchParams.set("referenceId", query.referenceId); if (query.referencePublicationId) url.searchParams.set("referencePublicationId", query.referencePublicationId); } }
  return url.toString();
}
export function builderRoutePath(route: BuilderRoute): string { return m4PublicPath(route.tenant, route.locale, route.kind, route.slug); }
