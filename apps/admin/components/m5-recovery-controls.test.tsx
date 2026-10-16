import { expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { M5DomainBinding } from "../../api/src/contracts/m5-domains";
import type { M5PlatformStatus } from "../../api/src/contracts/m5-platform";
import { DomainBindingActions } from "./domain-settings";
import { DeletionExecutionForm } from "./platform-operations";
import { DeletionSummary } from "./tenant-data";
const tenant = "a1111111-1111-4111-8111-111111111111";
const binding: M5DomainBinding = { id: "b1111111-1111-4111-8111-111111111111", tenantId: tenant, host: "clinic-a.localhost", state: "pending", tls: "unknown", generation: 2, version: 4, verifiedAt: null, tlsExpiresAt: null, origin: null };
const status: M5PlatformStatus = { tenantId: tenant, status: "deleting", version: 4, policy: { mode: "monitor", contentItemsLimit: null, mediaBytesLimit: null }, usage: { contentItems: 0, storedMediaBytes: 0, reservedMediaBytes: 0, mediaAccounting: "confirmed-and-reserved" }, capabilities: { read: false, export: false, businessWrite: false, safetyWrite: false }, deletion: { requestId: binding.id, phase: "failed", executeAfter: "2026-10-16T00:00:00.000Z", scope: "all-active-tenant-data", confirmed: true, failureCode: "STORAGE_UNAVAILABLE", completedAt: null }, readinessWarnings: [] };
it("offers verify-local for a pending current-primary generation without requiring another reverify", () => {
  const html = renderToStaticMarkup(createElement(DomainBindingActions, { binding, primaryBindingId: binding.id, locked: false, ready: false, onAction: () => undefined }));
  expect(html).toContain("Yêu cầu kiểm tra local"); expect(html).toContain("Địa chỉ chính hiện tại"); expect(html).not.toContain("Xác minh lại tên miền chính"); expect(html).not.toContain("Gỡ tên miền</button>"); expect(html).not.toContain("Đặt làm địa chỉ chính");
  const locked = renderToStaticMarkup(createElement(DomainBindingActions, { binding, primaryBindingId: binding.id, locked: true, ready: false, onAction: () => undefined }));
  expect(locked).toContain('disabled=""');
});
it("keeps explicit reverify available for an active current primary", () => {
  const html = renderToStaticMarkup(createElement(DomainBindingActions, { binding: { ...binding, state: "active", tls: "valid" }, primaryBindingId: binding.id, locked: false, ready: true, onAction: () => undefined }));
  expect(html).toContain("Xác minh lại tên miền chính"); expect(html).not.toContain("Yêu cầu kiểm tra local");
});
it("removes new execution controls after irreversible deletion has failed", () => {
  const html = renderToStaticMarkup(createElement(DeletionExecutionForm, { status, tenant, locked: false, observedAt: Date.parse("2026-10-16T01:00:00Z"), onSubmit: () => undefined }));
  expect(html).toBe("");
  const summary = renderToStaticMarkup(createElement(DeletionSummary, { status }));
  expect(summary).toContain("cùng worker"); expect(summary).toContain("Không tạo yêu cầu xóa mới"); expect(summary).not.toContain("STORAGE_UNAVAILABLE");
});
it("keeps the confirmed deletion form explicit and blocks an unelapsed executeAfter", () => {
  const html = renderToStaticMarkup(createElement(DeletionExecutionForm, { status: { ...status, deletion: { ...status.deletion, phase: "confirmed" } }, tenant, locked: false, observedAt: Date.parse("2026-10-15T23:00:00Z"), onSubmit: () => undefined }));
  expect(html).toContain("Bắt đầu xóa dữ liệu đã xác nhận"); expect(html).toContain('disabled=""'); expect(html).toContain("hệ thống không tự thực thi");
});
