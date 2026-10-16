import { expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { M5PlatformStatus } from "../../api/src/contracts/m5-platform";
import { DeletionSummary, QuotaUsage } from "./tenant-data";
const status: M5PlatformStatus = { tenantId: "a1111111-1111-4111-8111-111111111111", status: "suspended", version: 4, policy: { mode: "enforced", contentItemsLimit: 0, mediaBytesLimit: 10000 }, usage: { contentItems: 5, storedMediaBytes: 7000, reservedMediaBytes: 2000, mediaAccounting: "confirmed-and-reserved" }, capabilities: { read: true, export: true, businessWrite: false, safetyWrite: true }, deletion: { requestId: "b1111111-1111-4111-8111-111111111111", phase: "failed", executeAfter: "2026-10-16T00:00:00.000Z", scope: "all-active-tenant-data", confirmed: true, failureCode: "STORAGE_UNAVAILABLE", completedAt: null }, readinessWarnings: [] };
it("shows stored and reserved bytes separately and preserves explicit zero quota", () => {
  const html = renderToStaticMarkup(createElement(QuotaUsage, { status }));
  expect(html).toContain("5 / 0"); expect(html).toContain("7.000 byte"); expect(html).toContain("2.000 byte"); expect(html).toContain("Đang áp dụng"); expect(html).toContain("không có hạn mức số lượng");
  expect(renderToStaticMarkup(createElement(QuotaUsage, { status: { ...status, policy: { mode: "unset", contentItemsLimit: null, mediaBytesLimit: null } } }))).toContain("Chưa cấu hình");
});
it("keeps failed irreversible deletion distinct from completion and does not expose internal failure codes", () => {
  const html = renderToStaticMarkup(createElement(DeletionSummary, { status }));
  expect(html).toContain("chưa hoàn tất"); expect(html).toContain("không thể hoàn tác"); expect(html).not.toContain("STORAGE_UNAVAILABLE"); expect(html).not.toContain("Hoàn tất xóa");
});
