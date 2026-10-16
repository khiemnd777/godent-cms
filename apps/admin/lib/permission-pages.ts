import type { ContentPermission, ContentPermissions } from "../../api/src/contracts/m3";

/** Withdrawal is irreversible for this grant ID. A delayed read cannot restore it. */
export function mergePermissionRecord(previous: ContentPermission, incoming: ContentPermission) {
  return previous.withdrawnAt && !incoming.withdrawnAt ? previous : incoming;
}
export function mergePermissionUpdates(current: ContentPermissions, updates: ContentPermission[], placement: "prepend" | "append" = "prepend"): ContentPermissions {
  const byId = new Map(updates.map(item => [item.id, item])); const known = new Set(current.items.map(item => item.id));
  const existing = current.items.map(item => { const next = byId.get(item.id); return next ? mergePermissionRecord(item, next) : item; });
  const additions = [...byId.values()].filter(item => !known.has(item.id));
  return { items: placement === "prepend" ? [...additions, ...existing] : [...existing, ...additions], nextCursor: current.nextCursor };
}
export function mergePermissionPage(current: ContentPermissions, page: ContentPermissions, mode: "older" | "newest"): ContentPermissions {
  return { ...mergePermissionUpdates(current, page.items, mode === "older" ? "append" : "prepend"), nextCursor: page.nextCursor };
}
export function mergePermissionRead(current: ContentPermissions, updates: ContentPermission[], requestGeneration: number, currentGeneration: number) {
  return requestGeneration === currentGeneration ? mergePermissionUpdates(current, updates) : current;
}
