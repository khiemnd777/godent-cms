import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyContent } from "../../admin/lib/content-input";
import { sourceDocument } from "../../admin/lib/rich-text";
import type { ContentKind, ContentPublicMedia } from "../../api/src/contracts/m3";
import type { M4PrivateMedia, M4PrivatePreview, M4PublicReference, PromotionContent } from "../../api/src/contracts/m4";
import { createHomePage } from "../test-support/builder";
import { SignatureCards } from "./signature-content";
import { SignatureCollections } from "./signature-collections";
import { SignatureImage } from "./signature-image";
import { BuilderPrivateCopy } from "../../admin/components/builder-private-copy";

const signedPath = "http://127.0.0.1:5890/api/media/access?token=synthetic-signed-reference";
function media(path: string): ContentPublicMedia { return { slot: "image", media: { assetId: "original-image", revision: 1, alt: "Original clinic portrait", width: 800, height: 600, profile: "cover", path } }; }
function reference(kind: ContentKind, path: string | null): M4PublicReference {
  const content = emptyContent(kind); content.title = `Published ${kind}`; content.slug = kind;
  if (content.kind === "testimonial") { content.quote = "The team explained each option."; content.displayName = "Minh An"; }
  if ("image" in content) content.image = { assetId: "original-image", revision: 1, alt: "Original clinic portrait" };
  return { id: kind, kind, publicationId: `published-${kind}`, publicationVersion: 1, locale: "en", title: content.title, slug: content.slug, path: `/clinic-a/en/${kind}/care`, content, media: path ? [media(path)] : [], references: [] };
}
function campaign(path: string | null): M4PublicReference {
  const content: PromotionContent = { kind: "promotion", slug: "care-month", title: "Care month", summary: "Time for questions", body: sourceDocument("Discuss your options."), seo: { title: "", description: "" }, startAt: "2026-01-01T00:00:00.000Z", endAt: "2026-02-01T00:00:00.000Z", authoredTimezone: "Asia/Ho_Chi_Minh", conditions: "Appointments require confirmation.", references: [] };
  return { ...reference("article", null), kind: "promotion", content, references: [reference("case", path)] };
}
function renderPaths(path: string | null) {
  return [
    renderToStaticMarkup(<SignatureCards references={[reference("doctor", path)]} locale="en"/>),
    renderToStaticMarkup(<SignatureCollections references={[reference("testimonial", path)]} locale="en"/>),
    renderToStaticMarkup(<SignatureCollections references={[campaign(path)]} locale="en"/>),
  ];
}
test("Signature card, testimonial and campaign media accept signed absolute references without duplicating the API origin", () => {
  for (const html of renderPaths(signedPath)) {
    expect(html).toContain(`src="${signedPath}"`); expect(html).not.toContain("5890http://"); expect(html).toContain('loading="lazy"'); expect((html.match(/<img /g) ?? []).length).toBe(1);
  }
});
test("public relative references keep the current gateway and unavailable references never fall back to raw authored images", () => {
  for (const html of renderPaths("/api/public/builder-media/current/image/cover")) expect(html).toContain('src="http://127.0.0.1:5890/api/public/builder-media/current/image/cover"');
  for (const html of renderPaths(null)) { expect(html).not.toContain("<img"); expect(html).not.toContain("Original clinic portrait"); expect(html).not.toContain("/api/media/access"); }
});
test("an invalid image destination renders the unavailable state and never sends signed access to another origin", () => {
  for (const html of renderPaths("https://untrusted.invalid/api/media/access?token=private-reference")) { expect(html).not.toContain("<img"); expect(html).not.toContain("untrusted.invalid"); expect(html).not.toContain("private-reference"); expect(html).toContain("This image is unavailable"); }
});
test("a signed private image that has expired renders no image or capability URL", () => {
  const image: M4PrivateMedia = { slot: "image", assetId: "original-image", revision: 1, alt: "Expired portrait", url: signedPath, expiresAt: "2020-01-01T00:00:00.000Z" };
  const html = renderToStaticMarkup(<SignatureImage image={image} locale="en"/>);
  expect(html).not.toContain("<img"); expect(html).not.toContain(signedPath); expect(html).not.toContain("Expired portrait"); expect(html).toContain("This image is unavailable");
});
test("the actual Signature private-preview reference path renders signed doctor and testimonial images", () => {
  const home = createHomePage("en", "signature"), doctor = reference("doctor", signedPath), testimonial = reference("testimonial", signedPath);
  const closure: M4PrivatePreview = { id: "home", kind: "home", locale: "en", draftVersion: 1, content: home.content, config: { draftVersion: 1, content: home.config.content, logoMedia: null }, references: [doctor, testimonial], media: [], issues: [], sections: [
    { section: { id: "doctors", type: "doctors", hidden: false, title: "Our dentists", references: [], required: false }, references: [doctor], action: null, media: null, promotion: null, form: null },
    { section: { id: "perspectives", type: "testimonials", hidden: false, title: "Perspectives", references: [], required: false }, references: [testimonial], action: null, media: null, promotion: null, form: null },
  ] };
  const html = renderToStaticMarkup(<BuilderPrivateCopy closure={closure}/>);
  expect((html.match(/src="http:\/\/127\.0\.0\.1:5890\/api\/media\/access\?token=synthetic-signed-reference"/g) ?? []).length).toBe(2); expect(html).not.toContain("5890http://"); expect(html).toContain("language switching is disabled in private preview");
});
