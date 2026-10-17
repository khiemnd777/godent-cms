import type { BuilderSection, M4Content, M4Kind, M4PermissionScope, M4ResourceKind, ReferenceSectionType } from "../../api/src/contracts/m4";
import type { ReferenceKind } from "../../api/src/contracts/m3";
import { contentSections } from "./content-navigation";
import { emptyContent } from "./content-input";
import { sourceDocument } from "./rich-text";
export const kindLabel = (kind: M4ResourceKind): string => kind === "config" ? "Cấu hình website" : kind === "home" ? "Trang chủ" : kind === "page" ? "Trang nội dung" : kind === "landing" ? "Landing" : kind === "promotion" ? "Khuyến mãi" : kind === "service" ? "Dịch vụ" : contentSections[kind].title;
export const sectionLabels: Record<BuilderSection["type"], string> = { hero: "Hero / CTA", hero_carousel: "Banner chuyển ảnh", rich_text: "Nội dung chi tiết", services: "Dịch vụ / Chuyên khoa / Nhóm", doctors: "Bác sĩ", locations: "Cơ sở", prices: "Bảng giá", cases: "Ca điều trị", gallery: "Trước & sau", testimonials: "Đánh giá", articles: "Bài viết", faq: "FAQ", promotion: "Khuyến mãi", consultation: "Biểu mẫu tư vấn" };
export const sectionKinds: Record<ReferenceSectionType, readonly ReferenceKind[]> = { services: ["service", "specialty", "service_group"], doctors: ["doctor"], locations: ["location"], prices: ["price"], cases: ["case"], gallery: ["gallery"], testimonials: ["testimonial"], articles: ["article"], faq: ["faq"] };
export function newSection(type: Exclude<BuilderSection["type"], "promotion">): BuilderSection {
  const base = { id: crypto.randomUUID(), hidden: false };
  if (type === "hero") return { ...base, type, title: "", text: "", image: null, action: null };
  if (type === "hero_carousel") return { ...base, type, slides: [{ id: crypto.randomUUID(), title: "", text: "", image: null, action: null }], autoplay: false, intervalMs: 7000 };
  if (type === "rich_text") return { ...base, type, body: sourceDocument("") };
  if (type === "consultation") return { ...base, type, title: "", promotion: null, serviceOptions: [], locationOptions: [] };
  return { ...base, type, title: "", references: [], required: false };
}
export function emptyM4Content(kind: M4Kind): M4Content {
  const base = { slug: "", title: "", summary: "", body: sourceDocument(""), seo: { title: "", description: "" } };
  if (kind === "promotion") return { ...base, kind, startAt: "", endAt: "", authoredTimezone: "Asia/Ho_Chi_Minh", conditions: "", references: [] };
  if (kind === "service") return { ...base, coverImage: null, contentLinks: { references: [] } };
  if (kind === "home" || kind === "page" || kind === "landing") return { kind, slug: kind === "home" ? "home" : "", title: "", summary: "", seo: base.seo, sections: [{ id: "hero", type: "hero", hidden: false, title: "", text: "", image: null, action: null }, { id: "intro", type: "rich_text", hidden: false, body: base.body }] };
  return emptyContent(kind);
}
export const permissionKey = (scope: M4PermissionScope) => scope.type === "text" ? "text" : `asset:${scope.usage}:${scope.assetId}:${scope.assetRevision}`;
export function permissionScopes(kind: M4ResourceKind, content: M4Content): { label: string; scope: M4PermissionScope }[] {
  const scopes: { label: string; scope: M4PermissionScope }[] = ["case", "gallery", "testimonial"].includes(kind) ? [{ label: "Nội dung chữ", scope: { type: "text" } }] : [];
  const image = (value: { assetId: string; revision: number; alt: string } | null | undefined, usage: "logo" | "hero" | "page", label: string) => { if (value?.assetId) scopes.push({ label: `${label} · ${value.alt}`, scope: { type: "asset", assetId: value.assetId, assetRevision: value.revision, usage } }); };
  if ("name" in content) image(content.logo, "logo", "Logo");
  else if ("sections" in content) content.sections.forEach(section => { if (section.type === "hero") image(section.image, "hero", "Ảnh Hero"); if (section.type === "hero_carousel") section.slides.forEach((slide, index) => image(slide.image, "hero", `Ảnh banner ${index + 1}`)); });
  else if ("kind" in content && content.kind === "gallery") content.pairs.forEach((pair, index) => { image(pair.before, "page", `Ảnh trước ${index + 1}`); image(pair.after, "page", `Ảnh sau ${index + 1}`); });
  else if ("image" in content) image(content.image, "page", "Ảnh nội dung");
  else if ("coverImage" in content) image(content.coverImage, "page", "Ảnh đại diện");
  return scopes.filter((item, index) => scopes.findIndex(other => permissionKey(other.scope) === permissionKey(item.scope)) === index);
}
export function promotionState(startAt: string, endAt: string, now = Date.now()): "upcoming" | "active" | "expired" | null { const start = Date.parse(startAt), end = Date.parse(endAt); return !Number.isFinite(start) || !Number.isFinite(end) || start >= end ? null : now < start ? "upcoming" : now >= end ? "expired" : "active"; }
export function inputForInstant(value: string, timezone = "UTC") {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  try { const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); const part = (type: string) => parts.find(item => item.type === type)?.value; return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`; } catch { return ""; }
}
export function instantForInput(value: string, timezone = "UTC") {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return "";
  const wall = Date.parse(value + ":00.000Z"); if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) return "";
  let candidate = wall;
  for (let attempt = 0; attempt < 3; attempt++) { const shown = inputForInstant(new Date(candidate).toISOString(), timezone); if (!shown) return ""; candidate += wall - Date.parse(shown + ":00.000Z"); }
  if (inputForInstant(new Date(candidate).toISOString(), timezone) !== value) return "";
  // Repeated DST wall times need an explicit unambiguous instant; do not guess one.
  for (let minutes = -180; minutes <= 180; minutes += 15) {
    if (minutes && inputForInstant(new Date(candidate + minutes * 60000).toISOString(), timezone) === value) return "";
  }
  return new Date(candidate).toISOString();
}
