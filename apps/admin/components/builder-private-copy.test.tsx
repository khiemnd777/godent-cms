import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { M4_CONSENTS, type M4PrivatePreview, type M4PublicReference, type SitePresentation } from "../../api/src/contracts/m4";
import { emptyContent } from "../lib/content-input";
import { emptyBuilder } from "../lib/builder-state";
import { sourceDocument } from "../lib/rich-text";
import { BuilderPrivateCopy } from "./builder-private-copy";
const config: SitePresentation = { name: "Saved brand", logo: null, theme: "showcase", themeVersion: 1, palette: "blue", font: "system", layout: "compact", footer: { intro: "Saved footer", body: sourceDocument("Published separately") }, menu: [] };
const closure = (): M4PrivatePreview => ({ id: "page", kind: "landing", locale: "en", draftVersion: 2, content: emptyBuilder("landing"), config: { draftVersion: 3, content: config, logoMedia: null }, references: [], sections: [], media: [], issues: [] });
test("private preview renders resolved price and FAQ snapshots rather than reference counts", () => {
  const price = emptyContent("price"); if (price.kind !== "price") throw Error(); price.title = "Exact price"; price.price = { type: "from", amount: "123456789012345678901234.123456", currency: "VND", unit: "unit" };
  const faq = emptyContent("faq"); faq.title = "Published FAQ"; faq.body = sourceDocument("Answer from pinned publication");
  const reference = (content: typeof price | typeof faq): M4PublicReference => ({ id: content.kind, kind: content.kind, publicationId: `publication-${content.kind}`, publicationVersion: 2, locale: "en", title: content.title, slug: content.kind, path: `/clinic/en/${content.kind}`, content, media: [], references: [] });
  const saved = closure(); saved.sections = [{ section: { id: "prices", type: "prices", hidden: false, title: "Saved section heading", references: [], required: true }, references: [reference(price), reference(faq)], media: null, promotion: null, action: null, form: null }];
  const html = renderToStaticMarkup(<BuilderPrivateCopy closure={saved}/>);
  expect(html).toContain("Exact price"); expect(html).toContain("123,456,789,012,345,678,901,234.123456"); expect(html).toContain("Answer from pinned publication"); expect(html).toContain("<details>"); expect(html).toContain("Saved footer"); expect(html).toContain("bp-theme-showcase"); expect(html).not.toContain("nội dung đã chọn");
});
test("private forms are inert, use actual locale consent, and keep hidden content out", () => {
  const saved = closure(); saved.sections = [{ section: { id: "form", type: "consultation", hidden: false, title: "Request advice", promotion: null, serviceOptions: [], locationOptions: [] }, references: [], media: null, promotion: null, action: null, form: "disabled" }, { section: { id: "hidden", type: "rich_text", hidden: true, body: sourceDocument("Hidden narrative") }, references: [], media: null, promotion: null, action: null, form: null }];
  const html = renderToStaticMarkup(<BuilderPrivateCopy closure={saved}/>);
  expect(html).toContain('lang="en"'); expect(html).toContain("<fieldset disabled"); expect(html).toContain(M4_CONSENTS.en.copy); expect(html).not.toContain(M4_CONSENTS.vi.copy); expect(html).not.toContain("<form"); expect(html).not.toContain("Hidden narrative");
});
