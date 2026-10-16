import type { ContentKind, ContentPermissionScope, DentalContent } from "../../api/src/contracts/m3";
import type { ServiceMediaReference } from "../../api/src/contracts/s07";
import { permissionScopeKey } from "./content-permission";

export function supportsContentPermissionHistory(kind: ContentKind) {
  return ["case", "gallery", "testimonial", "doctor", "article"].includes(kind);
}

export function contentMedia(content: DentalContent): { label: string; image: ServiceMediaReference }[] {
  if (content.kind === "gallery") return content.pairs.flatMap((pair, index) => [{ label: `Cặp ${index + 1} · Trước`, image: pair.before }, { label: `Cặp ${index + 1} · Sau`, image: pair.after }]).filter(item => !!item.image.assetId);
  return "image" in content && content.image ? [{ label: "Ảnh đại diện", image: content.image }] : [];
}
export function contentPermissionScopes(content: DentalContent): { label: string; scope: ContentPermissionScope }[] {
  return [...(["case", "gallery", "testimonial"].includes(content.kind) ? [{ label: "Nội dung chữ, tên hiển thị và phần giới thiệu", scope: { type: "text" as const } }] : []), ...contentMedia(content).map(item => ({ label: `${item.label} · ${item.image.alt || "Chưa có mô tả"}`, scope: { type: "asset" as const, assetId: item.image.assetId, assetRevision: item.image.revision } }))];
}

export function contentPermissionSelection(content: DentalContent, selectedKey: string) {
  const scopes = contentPermissionScopes(content);
  return { scopes, selected: scopes.find(item => permissionScopeKey(item.scope) === selectedKey) };
}
