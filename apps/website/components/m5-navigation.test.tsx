import { expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { m4PublicPath, type M4PublicConfig, type PublicM4Page, type M4PublicReference } from "../../api/src/contracts/m4";
import type { M5Primary } from "../../api/src/contracts/m5-domains";
import { createHomePage, ids } from "../test-support/builder";
import { parsePublicBuilderList, parsePublicBuilderResolution } from "../lib/public-builder-validation";
import { BuilderPage } from "./builder-page";
import { BuilderListing } from "./builder-listing";
import { BuilderCards } from "./builder-content";

it("targets the absolute current primary from a custom entry for both themes, locales and primary modes", () => {
  for (const mode of ["godent", "custom"] as const) for (const theme of ["clarity", "showcase"] as const) for (const locale of ["vi", "en"] as const) {
    const primary: M5Primary = { mode, origin: mode === "godent" ? "http://localhost:5892" : "http://clinic-a.localhost:5892", basePath: mode === "godent" ? "/clinic-a" : "", bindingId: mode === "custom" ? ids.asset : null, version: 3 };
    const homePath = (primary.basePath + (locale === "en" ? "/en" : "")) || "/", expected = primary.origin + homePath;
    const page: PublicM4Page = createHomePage(locale, theme); page.canonicalUrl = expected; page.alternates[0].url = expected;
    const config = page.config as M4PublicConfig, target = { kind: "home" as const, id: ids.resource, locale };
    config.content.menu = [{ id: "home", label: "Homepage", target, allowViFallback: false }];
    config.menu = [{ ...config.content.menu[0], actualLocale: locale, fallback: false, path: homePath }];
    if (!("sections" in page.content) || page.content.sections[0].type !== "hero") throw new Error("Expected hero");
    page.content.sections[0].action = { label: "Open homepage", target, allowViFallback: false };
    page.sections[0].action = { label: "Open homepage", path: homePath, actualLocale: locale, fallback: false };
    const resolution = parsePublicBuilderResolution({ resolution: "page", requestedLocale: locale, actualLocale: locale, canonicalUrl: expected, fallbackPublicationId: null, page }, "clinic-a", locale, "home", "home", primary);
    if (resolution.resolution !== "page") throw new Error("Expected page");
    const html = renderToStaticMarkup(createElement(BuilderPage, { page: resolution.page, tenant: "clinic-a" }));
    expect(html).toContain(`class="builder-brand" href="${expected}"`); expect(html).toContain(`href="${expected}" lang="${locale}"`); expect(html).toContain(`class="builder-action" href="${expected}"`); expect(html).toContain('href="#main-content"');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]).filter(href => !href.startsWith("#"));
    for (const href of hrefs) expect(new URL(href, "http://entry-a.localhost:5892/").origin).toBe(primary.origin);
    const reference: M4PublicReference = { id: page.id, kind: "home", publicationId: page.publicationId, publicationVersion: page.publicationVersion, locale, title: "Homepage reference", slug: "home", path: homePath, content: page.content, references: [], media: [] };
    const cards = renderToStaticMarkup(createElement(BuilderCards, { references: [reference], locale, urlBase: primary }));
    expect(cards).toContain(`href="${expected}"`);
    const listingPath = primary.basePath + m4PublicPath("clinic-a", locale, "service").slice("clinic-a".length + 1);
    const listing = parsePublicBuilderList({ schemaVersion: 4, locale, kind: "service", items: [], config: null, nextCursor: "NEXT", canonicalUrl: primary.origin + listingPath }, "clinic-a", locale, "service", primary);
    const listHtml = renderToStaticMarkup(createElement(BuilderListing, { page: listing, tenant: "clinic-a", locale, kind: "service", query: { q: "care" } }));
    expect(listHtml).toContain(`action="${primary.origin}${listingPath}"`); expect(listHtml).toContain(`href="${primary.origin}${listingPath}?q=care&amp;cursor=NEXT"`);
  }
});
