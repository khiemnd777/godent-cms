import { PUBLIC_SITE_ORIGIN, S03_ROUTES, type PublicServicePage } from "../../api/src/contracts/s03";
import { boundedText, parseRichText, parseServiceInput, parseSlug } from "../../api/src/contracts/content";

/** This server consumer never reads request headers or forwards an admin session. */
export async function readPublicService(tenantSlug: string, serviceSlug: string): Promise<PublicServicePage | null> {
  try { parseSlug(tenantSlug); parseSlug(serviceSlug); } catch { return null; }
  const response = await fetch(`http://127.0.0.1:5890${S03_ROUTES.publicService(tenantSlug, serviceSlug)}`, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000), headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public content is temporarily unavailable");
  const page = await response.json() as PublicServicePage;
  try {
    if (page.schemaVersion !== 1 || page.locale !== "vi" || !Number.isSafeInteger(page.publicationVersion) || page.publicationVersion < 1 || !Number.isFinite(Date.parse(page.publishedAt)) || page.service.slug !== serviceSlug || page.canonicalUrl !== `${PUBLIC_SITE_ORIGIN}/${tenantSlug}/dich-vu/${serviceSlug}`) throw new Error();
    parseServiceInput(page.service); boundedText(page.site.name, 160, true); boundedText(page.site.footer.intro, 500); parseRichText(page.site.footer.body, 2000);
  } catch { throw new Error("Invalid public publication"); }
  return page;
}
