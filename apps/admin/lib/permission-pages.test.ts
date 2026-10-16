import { expect, test } from "bun:test";
import type { ContentPermission, ContentPermissions } from "../../api/src/contracts/m3";
import { mergePermissionPage, mergePermissionRead, mergePermissionUpdates } from "./permission-pages";
const permission = (index: number): ContentPermission => ({ id: `grant-${index}`, resourceId: "case-a", revision: index + 1, scope: { type: "text" }, evidenceReference: `record-${index}`, grantedAt: "2026-10-16T10:00:00.123456Z", grantedBy: "admin-a", withdrawnAt: null, withdrawalReason: null, purge: null });
test("older pages remain reachable and deduplicate an overlapping row", () => {
  const first: ContentPermissions = { items: Array.from({ length: 200 }, (_, i) => permission(i)), nextCursor: "after-199" };
  const result = mergePermissionPage(first, { items: [permission(199), permission(200)], nextCursor: null }, "older");
  expect(result.items.length).toBe(201); expect(result.items.at(-1)?.id).toBe("grant-200"); expect(result.nextCursor).toBeNull();
  expect(first.items.length).toBe(200); expect(first.nextCursor).toBe("after-199");
});
test("a withdrawal beyond the first 200 rows updates that row and preserves continuation", () => {
  const loaded: ContentPermissions = { items: Array.from({ length: 201 }, (_, i) => permission(i)), nextCursor: "more-history" };
  const withdrawn = { ...permission(200), withdrawnAt: "2026-10-16T11:00:00.000001Z", withdrawalReason: "Withdraw old grant", purge: { status: "pending" as const, attempts: 0, failureCode: null } };
  const result = mergePermissionUpdates(loaded, [withdrawn]);
  expect(result.items.length).toBe(201); expect(result.items[200]).toEqual(withdrawn); expect(result.items[0]).toBe(loaded.items[0]); expect(result.nextCursor).toBe("more-history");
});
test("new grants prepend without sorting away PostgreSQL microsecond order", () => {
  const loaded: ContentPermissions = { items: [permission(1), permission(2)], nextCursor: "older" };
  const result = mergePermissionUpdates(loaded, [permission(0)]);
  expect(result.items.map(item => item.id)).toEqual(["grant-0", "grant-1", "grant-2"]); expect(result.nextCursor).toBe("older");
});
test("a stale poll cannot replace an authoritative withdrawal or its pending purge", () => {
  const withdrawn = { ...permission(3), withdrawnAt: "2026-10-16T11:00:00Z", withdrawalReason: "Withdraw", purge: { status: "pending" as const, attempts: 0, failureCode: null } };
  const loaded: ContentPermissions = { items: [withdrawn], nextCursor: "older" };
  expect(mergePermissionRead(loaded, [permission(3)], 1, 2)).toBe(loaded);
  expect(mergePermissionUpdates(loaded, [permission(3)]).items[0]).toBe(withdrawn);
  const completed = { ...withdrawn, purge: { status: "completed" as const, attempts: 1, failureCode: null } };
  expect(mergePermissionRead(loaded, [completed], 2, 2)).toEqual({ items: [completed], nextCursor: "older" });
});
test("refreshing the newest page retains older loaded rows", () => {
  const loaded: ContentPermissions = { items: [permission(1), permission(2), permission(3)], nextCursor: null };
  const result = mergePermissionPage(loaded, { items: [permission(0), permission(1)], nextCursor: "after-1" }, "newest");
  expect(result.items.map(item => item.id)).toEqual(["grant-0", "grant-1", "grant-2", "grant-3"]); expect(result.nextCursor).toBe("after-1");
});
