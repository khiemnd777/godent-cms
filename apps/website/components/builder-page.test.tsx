import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePublicBuilderResolution } from "../lib/public-builder";
import { BuilderPage } from "./builder-page";

test("representative homepage renders only projected saved sections and escapes plain text", () => {
  const doc = { type: "doc", version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "Published clinic information" }] }] };
  const content = { kind: "home", slug: "home", title: "Homepage", summary: "", seo: { title: "", description: "" }, sections: [
    { id: "hero", type: "hero", hidden: false, title: "<script>unsafe</script>", text: "Care information", image: null, action: null },
    { id: "details", type: "rich_text", hidden: false, body: doc },
    { id: "hidden", type: "hero", hidden: true, title: "Hidden title", text: "Hidden copy", image: null, action: null },
  ] };
  const footer = { intro: "Clinic footer", body: { type: "doc", version: 1, blocks: [] } };
  const presentation = { name: "Clinic", logo: null, theme: "clarity", themeVersion: 1, palette: "teal", font: "system", layout: "comfortable", footer, menu: [] };
  const publicationId = "a1111111-1111-4111-8111-111111111111", configId = "b1111111-1111-4111-8111-111111111111", canonicalUrl = "http://localhost:5892/clinic-a";
  const result = parsePublicBuilderResolution({ resolution: "page", requestedLocale: "vi", actualLocale: "vi", canonicalUrl, fallbackPublicationId: null, page: {
    schemaVersion: 4, id: publicationId, kind: "home", locale: "vi", requestedLocale: "vi", actualLocale: "vi", publicationId, publicationVersion: 1, publishedAt: "2026-10-16T00:00:00.000Z", canonicalUrl, configPublicationId: configId,
    config: { publicationId: configId, publicationVersion: 1, locale: "vi", content: presentation, menu: [], logoMedia: null }, site: { name: presentation.name, footer }, content, references: [], media: [], sections: content.sections.filter(section => !section.hidden).map(section => ({ section, references: [], media: null, promotion: null, form: null, action: null })), form: null, promotionState: null, alternates: [{ locale: "vi", url: canonicalUrl, publicationId }], legacy: false,
  } }, "clinic-a", "vi", "home", "home");
  if (result.resolution !== "page") throw new Error("Expected page");
  const html = renderToStaticMarkup(createElement(BuilderPage, { page: result.page }));
  expect(html).toContain("Published clinic information"); expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;"); expect(html).not.toContain("<script>");
  expect(html).not.toContain("Hidden copy"); expect(html).not.toContain("Hidden title"); expect(html).not.toContain("/_next/image");
  expect(html).toContain(`data-publication="${publicationId}"`); expect(html).toContain(`data-config-publication="${configId}"`); expect(html).toContain('href="#main-content"');
});
