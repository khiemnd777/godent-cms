import { parseSlug } from "../../api/src/contracts/content";
import { contentPublicPath, M3_KINDS, M3_LIMITS, M3_PATHS, M3_ROUTES, type ContentKind, type ContentListQuery, type ContentReference, type PublicContentList, type PublicContentPage, type PublicServiceContentLinks, type ReferenceKind } from "../../api/src/contracts/m3";
import { parsePublicContentList, parsePublicContentPage, parsePublicServiceLinks } from "./public-content-validation";

export const CONTENT_LABELS: Record<ReferenceKind, { singular: string; plural: string }> = {
  specialty: { singular: "Chuyên khoa", plural: "Chuyên khoa" }, service_group: { singular: "Nhóm dịch vụ", plural: "Nhóm dịch vụ" }, service: { singular: "Dịch vụ", plural: "Dịch vụ" },
  location: { singular: "Cơ sở", plural: "Cơ sở" }, doctor: { singular: "Bác sĩ", plural: "Bác sĩ" }, price: { singular: "Giá dịch vụ", plural: "Bảng giá" },
  case: { singular: "Ca điều trị", plural: "Ca điều trị" }, gallery: { singular: "Trước và sau", plural: "Trước và sau" }, testimonial: { singular: "Đánh giá", plural: "Đánh giá" },
  article: { singular: "Bài viết", plural: "Bài viết" }, category: { singular: "Chuyên mục", plural: "Chuyên mục" }, faq: { singular: "Hỏi đáp", plural: "Hỏi đáp" },
};
export const PUBLIC_KINDS: ReferenceKind[] = ["specialty", "service_group", "service", "location", "doctor", "price", "case", "gallery", "testimonial", "article", "category", "faq"];
export function kindFromSection(section: string): ReferenceKind | null {
  return PUBLIC_KINDS.find(kind => M3_PATHS[kind] === section) ?? null;
}
export type PublicSearchParams = Record<string, string | string[] | undefined>;
export class InvalidPublicQuery extends Error { constructor() { super("Invalid public query"); } }
export function parsePublicQuery(params: PublicSearchParams): ContentListQuery {
  const one = (key: string) => { const value = params[key]; if (Array.isArray(value)) throw new InvalidPublicQuery(); return value; };
  const q = one("q")?.normalize("NFC").trim(), cursor = one("cursor"), referenceKind = one("referenceKind"), referenceId = one("referenceId"), referencePublicationId = one("referencePublicationId");
  if ((q && (q.length > M3_LIMITS.search || /[\u0000-\u001f\u007f]/.test(q))) || (cursor && (cursor.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(cursor)))) throw new InvalidPublicQuery();
  const filter = referenceKind || referenceId || referencePublicationId;
  const validId = (value: string | undefined) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  if (filter && (!PUBLIC_KINDS.includes(referenceKind as ReferenceKind) || !validId(referenceId) || (referencePublicationId !== undefined && !validId(referencePublicationId)))) throw new InvalidPublicQuery();
  return { ...(q ? { q } : {}), ...(cursor ? { cursor } : {}), ...(filter ? { referenceKind: referenceKind as ReferenceKind, referenceId, ...(referencePublicationId === undefined ? {} : { referencePublicationId }) } : {}) };
}
/** Reverse discovery follows all currently eligible pins to a resource, including older publications. */
export function reverseReferenceQuery(resource: Pick<ContentReference, "kind" | "id">): ContentListQuery {
  return parsePublicQuery({ referenceKind: resource.kind, referenceId: resource.id });
}
export function publicQueryString(query: ContentListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.referenceKind && query.referenceId) { params.set("referenceKind", query.referenceKind); params.set("referenceId", query.referenceId); if (query.referencePublicationId) params.set("referencePublicationId", query.referencePublicationId); }
  return params.size ? `?${params}` : "";
}
export function publicListingPath(tenant: string, kind: ReferenceKind, query: ContentListQuery = {}): string {
  return contentPublicPath(parseSlug(tenant), kind) + publicQueryString(query);
}
export function publicNavigation(tenant: string, current: ReferenceKind) {
  return PUBLIC_KINDS.map(kind => ({ href: contentPublicPath(tenant, kind), label: CONTENT_LABELS[kind].plural, current: kind === current }));
}

/** Fixed anonymous local API. Each render rechecks current eligibility; no request credentials are read. */
// https://nextjs.org/docs/app/api-reference/functions/fetch#optionscache
async function anonymousRead(path: string): Promise<unknown | null> {
  const response = await fetch(`http://127.0.0.1:5890${path}`, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000), headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public content is temporarily unavailable");
  try { const raw = await response.text(); if (new TextEncoder().encode(raw).byteLength > M3_LIMITS.publicBytes) throw new Error(); return JSON.parse(raw); }
  catch { throw new Error("Invalid public publication"); }
}
export async function readPublicContentList(tenant: string, kind: ReferenceKind, query: ContentListQuery = {}): Promise<PublicContentList | null> {
  try { parseSlug(tenant); if (!PUBLIC_KINDS.includes(kind)) return null; } catch { return null; }
  const value = await anonymousRead(M3_ROUTES.publicList(tenant, kind) + publicQueryString(query)); if (value === null) return null;
  try { return parsePublicContentList(value, tenant, kind); } catch { throw new Error("Invalid public publication"); }
}
export async function readPublicContentPage(tenant: string, kind: ContentKind, slug: string): Promise<PublicContentPage | null> {
  try { parseSlug(tenant); parseSlug(slug); if (!(M3_KINDS as readonly string[]).includes(kind)) return null; } catch { return null; }
  const value = await anonymousRead(M3_ROUTES.publicDetail(tenant, kind, slug)); if (value === null) return null;
  try { return parsePublicContentPage(value, tenant, kind, slug); } catch { throw new Error("Invalid public publication"); }
}
export async function readPublicServiceLinks(tenant: string, slug: string): Promise<PublicServiceContentLinks | null> {
  try { parseSlug(tenant); parseSlug(slug); } catch { return null; }
  const value = await anonymousRead(M3_ROUTES.publicServiceLinks(tenant, slug)); if (value === null) return null;
  try { return parsePublicServiceLinks(value, tenant); } catch { throw new Error("Invalid public publication"); }
}
