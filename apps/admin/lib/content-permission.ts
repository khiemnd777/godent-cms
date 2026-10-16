import type { ContentPermission, ContentPermissionScope } from "../../api/src/contracts/m3";
export function permissionScopeKey(scope: ContentPermissionScope) { return scope.type === "text" ? "text" : `asset:${scope.assetId}:${scope.assetRevision}`; }
/** This is a CMS status hint. The server remains the publication authority. */
export function permissionForRevision(permissions: ContentPermission[], resourceId: string, revision: number, scope: ContentPermissionScope) {
  return permissions.find(permission => permission.resourceId === resourceId && permission.revision === revision && !permission.withdrawnAt && permissionScopeKey(permission.scope) === permissionScopeKey(scope));
}
