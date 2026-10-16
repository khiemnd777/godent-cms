import { expect, test } from "bun:test";
import { pageStructuredData, publicPageMetadata, safeJsonLd } from "./builder-seo";
import { createHomePage, ids } from "../test-support/builder";
test("metadata uses actual locale and eligible alternates and removes withdrawn social images", () => {
  const page = createHomePage("en");
  const metadata = publicPageMetadata(page); expect(metadata.alternates?.canonical).toBe(page.canonicalUrl); expect(metadata.alternates?.languages).toEqual({ en: page.canonicalUrl }); expect(metadata.openGraph?.images).toEqual([]);
  const media = { assetId: ids.asset, revision: 1, alt: "Current image", width: 800, height: 600, profile: "cover" as const, path: `/api/public/builder-media/${ids.tenant}/home/${ids.resource}/en/${ids.publication}/${ids.asset}/1/cover` };
  page.sections[0].media = media; expect(JSON.stringify(publicPageMetadata(page))).toContain("Current image"); page.sections[0].media = null; expect(JSON.stringify(publicPageMetadata(page))).not.toContain("Current image");
});
test("structured data contains supplied facts and safely encodes HTML script delimiters", () => {
  const page = createHomePage(); page.site.name = "</script><script>unsafe</script>";
  const json = safeJsonLd(pageStructuredData(page, "clinic-a")); expect(json).not.toContain("<script"); expect(json).not.toContain("</script>"); expect(JSON.parse(json)).toHaveLength(2); expect(json).not.toContain("aggregateRating"); expect(json).not.toContain('"Review"');
});
