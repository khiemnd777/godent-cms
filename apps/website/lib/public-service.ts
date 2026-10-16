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
    if (![1,2].includes(page.schemaVersion) || page.locale !== "vi" || !Number.isSafeInteger(page.publicationVersion) || page.publicationVersion < 1 || !Number.isFinite(Date.parse(page.publishedAt)) || page.service.slug !== serviceSlug || page.canonicalUrl !== `${PUBLIC_SITE_ORIGIN}/${tenantSlug}/dich-vu/${serviceSlug}`) throw new Error();
    parseServiceInput(page.service); boundedText(page.site.name, 160, true); boundedText(page.site.footer.intro, 500); parseRichText(page.site.footer.body, 2000);
    if(page.coverMedia) {
      const media=page.coverMedia,ref=page.service.coverImage;
      if(!ref||media.assetId!==ref.assetId||media.revision!==ref.revision||media.alt!==ref.alt||media.profile!=='cover'||
        !Number.isSafeInteger(media.width)||!Number.isSafeInteger(media.height)||media.width<1||media.height<1||media.width>1600||media.height>1600||
        !/^\/api\/public\/media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[1-9][0-9]*\/cover$/.test(media.path)||!media.path.includes(`/${ref.assetId}/${ref.revision}/`)) throw new Error();
    }
  } catch { throw new Error("Invalid public publication"); }
  return page;
}
