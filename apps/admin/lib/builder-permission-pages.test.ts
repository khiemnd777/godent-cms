import { expect, test } from "bun:test";
import type { M4Permission } from "../../api/src/contracts/m4";
import { mergeBuilderPermission, mergeBuilderPermissionPage, mergeBuilderPermissionRows } from "./builder-permission-pages";
const permission = (id: string): M4Permission => ({ id, resourceId: "resource", kind: "case", locale: "vi", revision: 1, scope: { type: "text" }, grantedBy: "actor", evidenceReference: "synthetic", grantedAt: "2026-10-16T00:00:00.000Z", withdrawnAt: null, withdrawalReason: null, purge: null });
test("permission updates retain older loaded pages and their cursor", () => {
  const older = { items: [permission("old"), permission("oldest")], nextCursor: "older-cursor" };
  const newest = mergeBuilderPermissionPage(older, { items: [permission("new")], nextCursor: "first-page-cursor" }, false);
  expect(newest.items.map(item => item.id)).toEqual(["new", "old", "oldest"]);
  expect(newest.nextCursor).toBe("older-cursor");
  expect(mergeBuilderPermissionRows(newest.items, [{ ...permission("oldest"), withdrawnAt: "2026-10-16T01:00:00.000Z", withdrawalReason: "withdrawn" }]).at(-1)?.withdrawnAt).not.toBeNull();
});
test("stale reads cannot restore a withdrawn grant or completed purge", () => {
  const withdrawn = { ...permission("a"), withdrawnAt: "2026-10-16T01:00:00.000Z", purge: { status: "completed" as const, attempts: 2, failureCode: null } };
  expect(mergeBuilderPermission(withdrawn, permission("a"))).toEqual(withdrawn);
  expect(mergeBuilderPermission(withdrawn, { ...withdrawn, purge: { status: "pending", attempts: 1, failureCode: null } }).purge?.status).toBe("completed");
});
test("a confirmed purge retry can reset attempts while preserving other loaded rights", () => {
  const failed = { ...permission("a"), withdrawnAt: "2026-10-16T01:00:00.000Z", purge: { status: "failed" as const, attempts: 5, failureCode: "delivery_invalidation_failed" } };
  const retried = { ...failed, purge: { status: "pending" as const, attempts: 0, failureCode: null } };
  const rows = mergeBuilderPermissionRows([failed, permission("b")], [retried], true);
  expect(rows[0].purge?.status).toBe("pending"); expect(rows[0].purge?.attempts).toBe(0); expect(rows[1].id).toBe("b");
});
