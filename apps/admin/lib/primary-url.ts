import { m4PublicPath, type M4Kind, type M4Locale } from "../../api/src/contracts/m4";
import type { M5Primary } from "../../api/src/contracts/m5-domains";
export function primaryPublicUrl(primary: M5Primary, tenantSlug: string, locale: M4Locale, kind: M4Kind, slug?: string): string {
  const platform = m4PublicPath(tenantSlug, locale, kind, slug), sitePath = platform.slice(tenantSlug.length + 1);
  return primary.origin + (primary.basePath + sitePath || "/");
}
