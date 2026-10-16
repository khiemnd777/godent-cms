import { expect, test } from "bun:test";
import type { ContentPermission } from "../../api/src/contracts/m3";
import { permissionForRevision, permissionScopeKey } from "./content-permission";
import { contentPermissionScopes, contentPermissionSelection, supportsContentPermissionHistory } from "./content-media";
import { emptyContent } from "./content-input";
const permission: ContentPermission = { id: "grant-a", resourceId: "case-a", revision: 2, scope: { type: "text" }, evidenceReference: "private-record", grantedAt: "2026-10-16T00:00:00Z", grantedBy: "admin-a", withdrawnAt: null, withdrawalReason: null, purge: null };
test("permission status matches the exact resource and saved revision", () => {
  expect(permissionForRevision([permission], "case-a", 2, { type: "text" })?.id).toBe("grant-a");
  expect(permissionForRevision([permission], "case-b", 2, { type: "text" })).toBeUndefined();
  expect(permissionForRevision([permission], "case-a", 3, { type: "text" })).toBeUndefined();
  expect(permissionForRevision([{ ...permission, withdrawnAt: "2026-10-16T01:00:00Z" }], "case-a", 2, { type: "text" })).toBeUndefined();
});
test("asset permission does not cover text or a different asset revision", () => {
  const asset = { ...permission, scope: { type: "asset" as const, assetId: "photo-a", assetRevision: 1 } };
  expect(permissionScopeKey(asset.scope)).toBe("asset:photo-a:1");
  expect(permissionForRevision([asset], "case-a", 2, { type: "text" })).toBeUndefined();
  expect(permissionForRevision([asset], "case-a", 2, { type: "asset", assetId: "photo-a", assetRevision: 2 })).toBeUndefined();
});
test("S11 scopes always include text and each chosen image without a classifier bypass", () => {
  const content = emptyContent("gallery"); if (content.kind !== "gallery") throw new Error("Wrong type");
  const before = { assetId: "before", revision: 2, alt: "Trước", caption: "" }; const after = { assetId: "after", revision: 3, alt: "Sau", caption: "" };
  expect(contentPermissionScopes({ ...content, pairs: [{ before, after }] }).map(item => permissionScopeKey(item.scope))).toEqual(["text", "asset:before:2", "asset:after:3"]);
  const doctor = emptyContent("doctor"); if (doctor.kind !== "doctor") throw new Error("Wrong type");
  expect(contentPermissionScopes({ ...doctor, image: before }).map(item => permissionScopeKey(item.scope))).toEqual(["asset:before:2"]);
});
test("permission-capable content keeps historical controls when the current image is removed", () => {
  for (const kind of ["case", "gallery", "testimonial", "doctor", "article"] as const) {
    expect(supportsContentPermissionHistory(emptyContent(kind).kind)).toBe(true);
  }
  for (const kind of ["specialty", "service_group", "location", "price", "category", "faq"] as const) {
    expect(supportsContentPermissionHistory(kind)).toBe(false);
  }
});
test("removing a doctor or article image leaves no selectable current grant scope", () => {
  const image = { assetId: "patient-photo", revision: 2, alt: "Ảnh đã chọn" };
  for (const kind of ["doctor", "article"] as const) {
    const content = emptyContent(kind);
    if (content.kind !== "doctor" && content.kind !== "article") throw new Error("Wrong type");
    const key = "asset:patient-photo:2";
    expect(contentPermissionSelection({ ...content, image }, key).selected?.scope).toEqual({ type: "asset", assetId: "patient-photo", assetRevision: 2 });
    const next = { ...content, image: null };
    expect(supportsContentPermissionHistory(next.kind)).toBe(true);
    expect(contentPermissionSelection(next, key)).toEqual({ scopes: [], selected: undefined });
  }
});
test("a stale scope selection never falls back to another image or text scope", () => {
  const content = emptyContent("case");
  if (content.kind !== "case") throw new Error("Wrong type");
  const state = contentPermissionSelection({ ...content, image: { assetId: "new-photo", revision: 1, alt: "Ảnh mới" } }, "asset:old-photo:1");
  expect(state.scopes).toHaveLength(2);
  expect(state.selected).toBeUndefined();
  expect(contentPermissionSelection(content, "text").selected?.scope).toEqual({ type: "text" });
});
