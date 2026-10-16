import type { M4PublicConfig } from "../../api/src/contracts/m4";
import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuilderPage } from "../components/builder-page";
import { BuilderListing } from "../components/builder-listing";
import { homeResolution, ids } from "../test-support/builder";
import { parsePublicBuilderList, parsePublicBuilderResolution, parsePublicBuilderSeo } from "./public-builder-validation";
import { pageStructuredData, publicPageMetadata } from "./builder-seo";
import { entryFromHeaders, parsePublicEntry } from "./public-entry";
const primary = { mode: "custom" as const, bindingId: ids.asset, version: 3, origin: "http://clinic-a.test:5892", basePath: "" };
describe("M5 projected public rendering", () => {
  it("renders both themes and locales with the custom site root and one metadata identity", () => {
    for (const theme of ["clarity", "showcase"] as const) for (const locale of ["vi", "en"] as const) {
      const raw = homeResolution(locale), path = locale === "en" ? "/en" : "/", url = primary.origin + path;
      raw.canonicalUrl = url; raw.page.canonicalUrl = url; raw.page.alternates[0].url = url; raw.page.config.content.theme = theme;
      const target = { kind: "home" as const, id: ids.resource, locale };
      raw.page.config.content.menu = [{ id: "home", label: "Home", target, allowViFallback: false }];
      const config: M4PublicConfig = raw.page.config; config.menu = [{ id: "home", label: "Home", target, allowViFallback: false, path, actualLocale: locale, fallback: false }];
      const result = parsePublicBuilderResolution(raw, "clinic-a", locale, "home", "home", primary); if (result.resolution !== "page") throw new Error("Expected page");
      const html = renderToStaticMarkup(createElement(BuilderPage, { page: result.page, tenant: "clinic-a" }));
      expect(html).toContain(`theme-${theme}`); expect(html).toContain(`href="${primary.origin}${path}"`); expect(html).not.toContain('href="/clinic-a'); expect(html).toContain(`data-publication="${ids.publication}"`); expect(html).toContain(`data-config-publication="${ids.config}"`);
      const metadata = publicPageMetadata(result.page); expect(metadata.alternates?.canonical).toBe(url); expect(metadata.openGraph).toMatchObject({ url });
      expect(JSON.stringify(pageStructuredData(result.page, "clinic-a"))).toContain(primary.origin + path + "#organization");
      expect(() => parsePublicBuilderResolution({ ...raw, canonicalUrl: "http://evil.test/" }, "clinic-a", locale, "home", "home", primary)).toThrow();
      config.menu[0].path = `/clinic-b${path === "/" ? "" : path}`;
      expect(() => parsePublicBuilderResolution(raw, "clinic-a", locale, "home", "home", primary)).toThrow();
    }
  });
  it("uses custom-root listing forms, filters, browse and pagination links", () => {
    for (const locale of ["vi", "en"] as const) {
      const path = `${locale === "en" ? "/en" : ""}/dich-vu`;
      const parsed = parsePublicBuilderList({ schemaVersion: 4, locale, kind: "service", items: [], config: null, nextCursor: "NEXT", canonicalUrl: primary.origin + path }, "clinic-a", locale, "service", primary);
      const html = renderToStaticMarkup(createElement(BuilderListing, { page: parsed, tenant: "clinic-a", kind: "service", locale, query: { q: "care" } }));
      expect(html).toContain(`action="${primary.origin}${path}"`); expect(html).toContain(`${path}?q=care&amp;cursor=NEXT`); expect(html).not.toContain('href="/clinic-a');
    }
  });
  it("keeps strict SEO closure while accepting current custom-primary URLs", () => {
    const entry = { kind: "home", id: ids.resource, locale: "vi", path: "/", canonicalUrl: primary.origin + "/", publicationId: ids.publication, configPublicationId: ids.config, alternates: [{ locale: "vi", url: primary.origin + "/", publicationId: ids.publication }] };
    expect(parsePublicBuilderSeo([entry], "clinic-a", primary)[0].canonicalUrl).toBe(primary.origin + "/");
    for (const invalid of [primary.origin + "/?private=x", primary.origin + ".evil/", "http://evil.test/"]) expect(() => parsePublicBuilderSeo([{ ...entry, alternates: [{ ...entry.alternates[0], url: invalid }] }], "clinic-a", primary)).toThrow();
  });
  it("rejects forged entry scopes, origins and modes before trusting output URLs", () => {
    const raw = { tenantId: ids.tenant, siteId: ids.tenant, tenantSlug: "clinic-a", entry: { mode: "custom", origin: primary.origin, basePath: "", bindingId: ids.asset, generation: 1 }, primary, sitePagePath: "/en" };
    expect(parsePublicEntry(raw, "clinic-a.test:5892").tenantSlug).toBe("clinic-a");
    expect(() => parsePublicEntry(raw, "clinic-b.test:5892")).toThrow();
    expect(() => parsePublicEntry({ ...raw, entry: { ...raw.entry, basePath: "/clinic-b" } })).toThrow();
    expect(() => parsePublicEntry({ ...raw, primary: { ...primary, origin: "https://evil.test" } })).toThrow();
    expect(() => parsePublicEntry({ ...raw, sitePagePath: "//evil.test" })).toThrow();
    expect(() => parsePublicEntry({ ...raw, secret: "private" })).toThrow();
    expect(() => entryFromHeaders(new Headers(), "clinic-a")).toThrow("Missing public entry context");
    expect(() => entryFromHeaders(new Headers({ "x-gcms-entry": JSON.stringify(raw) }), "clinic-b")).toThrow("Public entry changed");
  });
});
