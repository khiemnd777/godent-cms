import type { M4Page, M4Permission } from "../../api/src/contracts/m4";
export function mergeBuilderPermission(old: M4Permission | undefined, next: M4Permission): M4Permission {
  if (!old) return next;
  if (old.withdrawnAt && !next.withdrawnAt) return old;
  const stalePurge = old.purge && next.purge && (old.purge.attempts > next.purge.attempts || old.purge.status === "completed" && next.purge.status !== "completed");
  return stalePurge ? { ...next, purge: old.purge } : next;
}
export function mergeBuilderPermissionRows(items: M4Permission[], updates: M4Permission[], authoritative = false) {
  const known = new Map(items.map(item => [item.id, item]));
  // An accepted retry deliberately starts a new attempt cycle at zero.
  for (const item of updates) known.set(item.id, authoritative ? item : mergeBuilderPermission(known.get(item.id), item));
  return [...known.values()];
}
export function mergeBuilderPermissionPage(previous: M4Page<M4Permission>, next: M4Page<M4Permission>, older: boolean): M4Page<M4Permission> {
  const merged = mergeBuilderPermissionRows(previous.items, next.items);
  const items = older ? merged : [...next.items.map(item => merged.find(value => value.id === item.id)!), ...merged.filter(item => !next.items.some(value => value.id === item.id))];
  return { items, nextCursor: older || !previous.items.length ? next.nextCursor : previous.nextCursor };
}
