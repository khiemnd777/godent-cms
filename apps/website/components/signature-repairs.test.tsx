import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyContent } from "../../admin/lib/content-input";
import type { M4PrivatePreview, PublicM4Page } from "../../api/src/contracts/m4";
import { createHomePage, ids, landingContext, testDoc } from "../test-support/builder";
import { SignatureCarouselContent, SignatureFrame, signatureHeaderEscapeTarget } from "./signature-ui";
import { SignatureResource } from "./signature-resource";
import { BuilderPage } from "./builder-page";
import { BuilderPrivateCopy } from "../../admin/components/builder-private-copy";
import { scopePublicResult } from "../lib/public-url-context";

function servicePage(): PublicM4Page {
  return { ...createHomePage("en", "signature"), kind: "service", content: { title: "Care for your smile", summary: "A personal care conversation", slug: "care", body: testDoc, seo: { title: "", description: "" }, coverImage: null }, sections: [], media: [{ slot: "image", media: { assetId: ids.asset, revision: 1, alt: "Published service scene", width: 1000, height: 650, profile: "cover", path: "/api/public/builder-media/current/image/cover" } }], form: { ...landingContext(), sourceType: "service" } };
}
function expectUniqueIds(html: string) { const identifiers = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]); expect(new Set(identifiers).size).toBe(identifiers.length); }
test("a main carousel retains one accessible H1 outside hidden slide groups at either active index", () => {
  const slides = [{ id: "first", title: "A comfortable smile", text: "Care information" }, { id: "second", title: "Care for every age", text: "More information" }];
  for (const visible of [0, 1]) {
    const html = renderToStaticMarkup(<SignatureCarouselContent slides={slides} visible={visible} mainHeading id="slides" live="polite"/>);
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1); expect(html.indexOf("<h1")).toBeLessThan(html.indexOf('<div id="slides"')); expect(html).toContain('<h1 class="visually-hidden">A comfortable smile</h1>'); expect(html).toContain('<h2>Care for every age</h2>');
    expect(html).toContain(`aria-label="${visible + 1} / 2"><div`); expect(html).toContain(`aria-label="${2 - visible} / 2" hidden=""`);
  }
  expect(renderToStaticMarkup(<SignatureCarouselContent slides={slides} visible={1} mainHeading={false} id="secondary" live="off"/>)).not.toContain("<h1");
});
test("private inquiry regions retain the public structure with disabled controls and no outgoing CTA links", () => {
  const html = renderToStaticMarkup(<SignatureFrame name="Clinic" locale="en" currentPath="" menu={[]} contacts={[]} languages={[]} consultationHref="https://outside.invalid/request" privatePreview footer="Clinic information">Content</SignatureFrame>);
  expect(html).toContain("signature-floating-book"); expect(html).toContain("signature-floating-contact"); expect(html).toContain("signature-mobile-contact"); expect(html).not.toContain("outside.invalid");
  const mobile = html.match(/<nav class="signature-mobile-contact".*?<\/nav>/)?.[0] ?? "";
  expect((mobile.match(/<button /g) ?? []).length).toBe(4); expect((mobile.match(/disabled=""/g) ?? []).length).toBe(4); expect(mobile).not.toContain("href=");
  const doctor = emptyContent("doctor"); doctor.title = "Doctor Minh An";
  const profile = renderToStaticMarkup(<SignatureResource kind="doctor" content={doctor} locale="en" references={[]} privatePreview/>);
  expect(profile).toContain("signature-consultation-aside"); expect(profile).toContain("Talk with the clinic"); expect((profile.match(/class="signature-button" disabled/g) ?? []).length).toBe(2); expect(profile).not.toContain("href=");
});
test("Signature service banner and real compact form precede breadcrumb and body, with distinct form instance IDs", () => {
  const page = servicePage(), html = renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={page}/>);
  expect(html.indexOf("signature-service-banner")).toBeLessThan(html.indexOf("consultation-compact")); expect(html.indexOf("consultation-compact")).toBeLessThan(html.indexOf('class="breadcrumbs"')); expect(html.indexOf('class="breadcrumbs"')).toBeLessThan(html.indexOf("signature-resource-layout"));
  expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1); expect((html.match(/id="consultation"/g) ?? []).length).toBe(1); expect(html).toContain(`consultation-${ids.resource}-service-top-title`); expect(html).toContain(`consultation-${ids.resource}-service-details-title`); expectUniqueIds(html);
  const retained = structuredClone(page); retained.config!.content.theme = "clarity"; expect(renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={retained}/>)).not.toContain("signature-service-banner");
  const price = emptyContent("price"); if (price.kind !== "price") throw Error(); price.price = { type: "exact", amount: "350000", currency: "VND", unit: "visit" }; const pricing: PublicM4Page = { ...page, kind: "price", content: price, form: null };
  expect(renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={pricing}/>)).not.toContain("signature-service-banner");
});
test("private service uses the same banner and two disabled form layouts with signed media and unique IDs", () => {
  const page = servicePage(), closure: M4PrivatePreview = { id: page.id, kind: "service", locale: "en", draftVersion: 1, content: page.content, config: { draftVersion: 1, content: page.config!.content, logoMedia: null }, references: [], sections: [], issues: [], media: [{ slot: "image", assetId: ids.asset, revision: 1, alt: "Signed service scene", url: "http://127.0.0.1:5890/api/media/access?token=synthetic-service", expiresAt: new Date(Date.now() + 30000).toISOString() }] };
  const html = renderToStaticMarkup(<BuilderPrivateCopy closure={closure}/>);
  expect(html.indexOf("signature-service-banner")).toBeLessThan(html.indexOf("consultation-compact")); expect(html.indexOf("consultation-compact")).toBeLessThan(html.indexOf('class="breadcrumbs"')); expect(html.indexOf('class="breadcrumbs"')).toBeLessThan(html.indexOf("signature-resource-layout")); expect(html).toContain('src="http://127.0.0.1:5890/api/media/access?token=synthetic-service"');
  expect((html.match(/<fieldset disabled/g) ?? []).length).toBe(2); expect(html).toContain("private-service-top-contact-help"); expect(html).toContain("private-service-details-contact-help"); expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1); expectUniqueIds(html);
});
test("an ineligible compact homepage form keeps its consultation anchor and explicit unavailable message", () => {
  const page = createHomePage("en", "signature"), carousel = { id: "banner", type: "hero_carousel" as const, hidden: false, autoplay: false, intervalMs: 7000 as const, slides: [{ id: "one", title: "Care information", text: "Clinic highlights", image: null, action: null }] }, consultation = { id: "request", type: "consultation" as const, hidden: false, title: "Talk with us", promotion: null, serviceOptions: [], locationOptions: [] };
  page.sections = [{ section: carousel, slides: [{ id: "one", title: "Care information", text: "Clinic highlights", media: null, action: null }], media: null, action: null, form: null, promotion: null, references: [] }, { section: consultation, media: null, action: null, form: null, promotion: null, references: [] }];
  const html = renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={page}/>);
  expect((html.match(/id="consultation"/g) ?? []).length).toBe(1); expect(html).toContain("Talk with us"); expect(html).toContain("This page is not accepting new consultation requests."); expect(html).toContain("consultation-unavailable");
});
test("Escape restores the visible search trigger before considering the mobile menu trigger", () => {
  expect(signatureHeaderEscapeTarget(true, false)).toBe("search"); expect(signatureHeaderEscapeTarget(true, true)).toBe("search"); expect(signatureHeaderEscapeTarget(false, true)).toBe("menu"); expect(signatureHeaderEscapeTarget(false, false)).toBeNull();
});
test("Signature navigation compares paths in the same primary URL context on platform and custom entries", () => {
  for (const base of [{ origin: "http://localhost:5892", basePath: "/clinic-a" }, { origin: "http://clinic-a.test:5892", basePath: "" }]) {
    const page: PublicM4Page = createHomePage("en", "signature"), path = `${base.basePath}/en`; page.canonicalUrl = base.origin + path;
    page.config!.signature = { navigation: [{ id: "home", type: "resource", label: "Current home", path, actualLocale: "en", fallback: false, children: [] }], headerLocation: null, footerLocations: [] };
    scopePublicResult(page, base); const html = renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={page}/>);
    expect(html).toContain(`href="${base.origin}${path}" lang="en" aria-current="page">Current home</a>`);
  }
});
test("a Signature pricing page shares a compact title banner before breadcrumbs, keeps its image and renders the authored introduction once", () => {
  const page: PublicM4Page = { ...createHomePage("en", "signature"), kind: "page" }, title = "Care fees", text = "Review the scope and conditions before your visit.";
  const hero = { id: "pricing-intro", type: "hero" as const, hidden: false, title, text, image: null, action: null }, prose = { id: "explanation", type: "rich_text" as const, hidden: false, body: { ...testDoc, blocks: [{ type: "paragraph" as const, children: [{ type: "text" as const, text }] }] } }, prices = { id: "prices", type: "prices" as const, hidden: false, title: "Published fees", references: [], required: false };
  page.content = { kind: "page", slug: "care-fees", title, summary: text, seo: { title: "", description: "" }, sections: [hero, prose, prices] };
  const image = servicePage().media[0].media;
  page.sections = [hero, prose, prices].map(section => ({ section, action: null, media: section.type === "hero" ? image : null, promotion: null, form: null, references: [] }));
  const publicHtml = renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={page}/>), closure: M4PrivatePreview = { id: page.id, kind: "page", locale: "en", draftVersion: 1, content: page.content, config: { draftVersion: 1, content: page.config!.content, logoMedia: null }, references: [], sections: page.sections.map(section => ({ section: section.section, references: section.references, action: section.action, promotion: section.promotion, form: null, media: section.media ? { slot: "hero", assetId: ids.asset, revision: 1, alt: "Signed banner scene", url: "http://127.0.0.1:5890/api/media/access?token=synthetic-pricing", expiresAt: new Date(Date.now() + 30000).toISOString() } : null })), media: [], issues: [] };
  const privateHtml = renderToStaticMarkup(<BuilderPrivateCopy closure={closure}/>);
  for (const html of [publicHtml, privateHtml]) { expect(html.indexOf('class="signature-price-header"')).toBeLessThan(html.indexOf('class="breadcrumbs"')); expect(html.indexOf('class="breadcrumbs"')).toBeLessThan(html.indexOf("signature-price-introduction")); expect(html.indexOf("signature-price-introduction")).toBeLessThan(html.indexOf("Published fees")); expect(html).toContain('class="signature-price-header-image" aria-hidden="true"'); expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1); expect((html.match(/Review the scope and conditions before your visit\./g) ?? []).length).toBe(1); expect(html).not.toContain("signature-intro has-image"); expect(html).not.toContain("signature-service-banner"); expectUniqueIds(html); }
  expect(privateHtml).toContain('src="http://127.0.0.1:5890/api/media/access?token=synthetic-pricing"'); expect(publicHtml).toContain("/api/public/builder-media/current/image/cover");
});
