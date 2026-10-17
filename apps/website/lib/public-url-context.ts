import { m4PublicPath, type M4Kind, type M4Locale } from "../../api/src/contracts/m4";
import { parseBuilderQuery, safeTracking } from "./builder-routing";

export type PublicUrlBase = { origin: string; basePath: string };
const scopes = new WeakMap<object, PublicUrlBase>();
/** Only server-validated entry context can attach a primary URL base to parsed output. */
export function scopePublicResult<T extends object>(value: T, primary?: PublicUrlBase): T { if (primary) scopes.set(value, primary); return value; }
export function publicUrlBase(value: object): PublicUrlBase | undefined { return scopes.get(value); }
export function publicPath(tenant: string, locale: M4Locale, kind: M4Kind, slug?: string, primary?: PublicUrlBase): string {
  const platform = m4PublicPath(tenant, locale, kind, slug);
  if (!primary) return platform;
  const sitePath = platform.slice(tenant.length + 1);
  return primary.basePath + sitePath || "/";
}
export function redirectQuery(canonical: string, params: URLSearchParams, fallback: boolean, listing: boolean): string {
  const url = new URL(canonical);
  if (listing) {
    const values = Object.fromEntries([...params.keys()].map(key => [key, params.getAll(key).length > 1 ? params.getAll(key) : params.get(key)!]));
    const query = parseBuilderQuery(values);
    if (fallback) delete query.cursor;
    url.search = "";
    for (const [key, value] of Object.entries(query)) if (value) url.searchParams.set(key, String(value));
  }
  for (const [key, value] of Object.entries(safeTracking(params))) url.searchParams.set(`utm_${key}`, value);
  return url.toString();
}

/** Resolved paths belong to the primary origin, including reads through another valid entry. */
export function navigationHref(path: string, primary?: PublicUrlBase): string {
  if (!primary) return path;
  if (!path.startsWith("/") || path.startsWith("//")) throw new TypeError("Invalid public navigation path");
  const url = new URL(path, primary.origin); if (url.origin !== primary.origin) throw new TypeError("Invalid public navigation origin"); return url.href;
}
export function publicHref(tenant: string, locale: M4Locale, kind: M4Kind, slug?: string, primary?: PublicUrlBase): string { return navigationHref(publicPath(tenant, locale, kind, slug, primary), primary); }
