import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { M3_KINDS, type ContentKind, type DentalContent } from "../../api/src/contracts/m3";
import { m4PublicPath, type M4Content, type M4Kind, type M4Locale, type M4PublicList, type M4PublicReference, type PromotionContent, type PublicM4Page } from "../../api/src/contracts/m4";
import { emptyContent } from "../../admin/lib/content-input";
import { sourceDocument } from "../../admin/lib/rich-text";
import { createHomePage, ids } from "../test-support/builder";
import { SignatureResource } from "./signature-resource";
import { SignatureCollections, SignatureSupportingCollections } from "./signature-collections";
import { SignatureListing } from "./signature-listing";
import { SignatureCards } from "./signature-content";
import { BuilderPage } from "./builder-page";
import type { RichTextDocument } from "../../api/src/contracts/s03";

function content(kind: ContentKind): DentalContent {
  const body: RichTextDocument = { type: "doc", version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "An original introduction" }] }, { type: "heading", children: [{ type: "text", text: "First topic" }] }, { type: "paragraph", children: [{ type: "text", text: "First answer" }] }, { type: "heading", children: [{ type: "text", text: "Second topic" }] }, { type: "paragraph", children: [{ type: "text", text: "Second answer" }] }] };
  const item = { ...emptyContent(kind), slug: `${kind}-care`, title: `Published ${kind}`, summary: "An original introduction", body };
  if (item.kind === "price") item.price = { type: "exact", amount: "350000", currency: "VND", unit: "visit" };
  return item;
}
function reference(kind: M4Kind, content: M4Content, locale: M4Locale = "en"): M4PublicReference {
  if (!("title" in content) || !("slug" in content)) throw Error();
  return { id: `${kind}-${ids.resource}`, kind, title: content.title, slug: content.slug, path: m4PublicPath("clinic-a", locale, kind, content.slug), publicationId: `${kind}-${ids.publication}`, publicationVersion: 1, locale, content, references: [], media: [] };
}
const promotion: PromotionContent = { kind: "promotion", slug: "care-month", title: "Care conversations", summary: "Time for questions", body: sourceDocument("Time for questions\n\n# Your visit\n\nDiscuss the options"), seo: { title: "", description: "" }, startAt: "2026-01-01T01:00:00.000Z", endAt: "2026-02-01T01:00:00.000Z", authoredTimezone: "Asia/Ho_Chi_Minh", conditions: "A consultation does not confirm treatment or a discount.", references: [] };

test("every resource family renders an actual detail, a single page heading and reachable contents", () => {
  for (const locale of ["vi", "en"] as const) for (const kind of M3_KINDS) {
    const item = content(kind), html = renderToStaticMarkup(<SignatureResource kind={kind} content={item} locale={locale} references={[]} consultationHref="/clinic-a#consultation"/>);
    expect(html).toContain(`resource-${kind}`); expect(html).toContain(item.title); expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    expect(html).toContain(`href="#body-${kind}-0"`); expect(html).toContain(`id="body-${kind}-0"`); expect(html).toContain(`href="#body-${kind}-2"`); expect(html).toContain("First answer");
    expect((html.match(/An original introduction/g) ?? []).length).toBe(1); expect(html).not.toContain("signature-cards");
  }
});
test("dentist cards deduplicate the title, while profiles retain languages, qualifications and specialty links", () => {
  const doctor = content("doctor"); if (doctor.kind !== "doctor") throw Error(); doctor.summary = doctor.professionalTitle = "Care for every age"; doctor.languages = ["Tiếng Việt", "English"]; doctor.credentials = ["Published qualification"];
  const ref = reference("doctor", doctor), specialty = reference("specialty", content("specialty"));
  const card = renderToStaticMarkup(<SignatureCards references={[ref]} locale="en"/>); expect((card.match(/Care for every age/g) ?? []).length).toBe(1); expect(card).toContain("Meet the dentist");
  const profile = renderToStaticMarkup(<SignatureResource kind="doctor" content={doctor} locale="en" references={[specialty]} media={<span>Projected portrait</span>} consultationHref="/clinic-a/en#consultation"/>);
  expect(profile).toContain("signature-profile-portrait"); expect(profile).toContain("Projected portrait"); expect(profile).toContain("Consultation languages"); expect(profile).toContain("Published qualification"); expect(profile).toContain(specialty.path); expect(profile).toContain("Talk with the clinic");
});
test("prices use published service groups, exact decimal strings, locations and disclosed conditions", () => {
  const price = content("price"); if (price.kind !== "price") throw Error(); price.price = { type: "from", amount: "123456789012345678901234.123456", currency: "VND", unit: "care item" }; price.inclusions = "Defined care scope"; price.notes = "Discuss the final plan";
  const service = reference("service", { slug: "care", title: "Care service", summary: "", body: sourceDocument(""), seo: { title: "", description: "" } }), group = reference("specialty", { ...content("specialty"), title: "Published care group" }), clinic = reference("location", content("location")); service.references = [group];
  const ref = reference("price", price); ref.references = [service, clinic];
  const html = renderToStaticMarkup(<SignatureCollections references={[ref]} locale="en" nested={false}/>);
  expect(html).toContain("<h2>Published care group</h2>"); expect(html).toContain('scope="row"'); expect(html).toContain("123,456,789,012,345,678,901,234.123456 VND"); expect(html).toContain("Defined care scope"); expect(html).toContain("Discuss the final plan"); expect(html).toContain(clinic.path);
});
test("locations expose source addresses and split opening hours, and testimonials use the saved quotation", () => {
  const location = content("location"); if (location.kind !== "location") throw Error(); location.address = "12 Quiet Garden"; location.openingHours = [{ day: 0, closed: true, intervals: [] }, { day: 1, closed: false, intervals: [{ opens: "08:00", closes: "12:00" }, { opens: "13:30", closes: "18:00" }] }];
  const ref = reference("location", location), cards = renderToStaticMarkup(<SignatureCollections references={[ref]} locale="en"/>), detail = renderToStaticMarkup(<SignatureResource kind="location" content={location} locale="en" references={[]}/>);
  expect(cards).toContain("signature-location-cards"); expect(cards).toContain("12 Quiet Garden"); expect(cards).toContain("08:00–12:00, 13:30–18:00"); expect(detail).toContain("Monday"); expect(detail).toContain("Closed"); expect(detail).not.toContain("iframe");
  const quote = content("testimonial"); if (quote.kind !== "testimonial") throw Error(); quote.quote = "The discussion answered my questions."; quote.displayName = "Minh An"; quote.attribution = "A published perspective";
  const html = renderToStaticMarkup(<SignatureCollections references={[reference("testimonial", quote)]} locale="en"/>); expect(html).toContain("<blockquote>"); expect(html).toContain(quote.quote); expect(html).toContain("Minh An"); expect(html).toContain(quote.attribution);
});
test("campaign details show the projected status, dates, conditions and explicit preview state", () => {
  for (const [state, text] of [["active", "Active campaign"], ["upcoming", "has not started"], ["expired", "has ended"]] as const) { const html = renderToStaticMarkup(<SignatureResource kind="promotion" content={promotion} locale="en" references={[]} promotionState={state}/>); expect(html).toContain(text); expect(html).toContain("Asia/Ho_Chi_Minh"); expect(html).toContain(promotion.conditions); }
  const preview = renderToStaticMarkup(<SignatureResource kind="promotion" content={promotion} locale="en" references={[]} privatePreview/>); expect(preview).toContain("Saved campaign information"); expect(preview).not.toContain("has ended");
});
test("article categories, FAQ answers and mixed supporting references remain distinct", () => {
  const article = content("article"); if (article.kind !== "article") throw Error(); article.attribution = "Clinic editorial team";
  const category = reference("category", content("category")), faq = reference("faq", { ...content("faq"), title: "A useful question", body: sourceDocument("A published answer") });
  const html = renderToStaticMarkup(<SignatureResource kind="article" content={article} locale="en" references={[category, faq]}/>); expect(html).toContain("Clinic editorial team"); expect(html).toContain(category.path); expect(html).toContain("<summary>A useful question</summary>"); expect(html).toContain("A published answer");
  const price = content("price"); if (price.kind !== "price") throw Error(); price.price = { type: "exact", amount: "350000", currency: "VND", unit: "visit" };
  const supporting = renderToStaticMarkup(<SignatureSupportingCollections references={[reference("price", price), reference("gallery", content("gallery"))]} locale="en"/>); expect(supporting).toContain("signature-price-table"); expect(supporting).toContain("signature-gallery-collection"); expect(supporting).not.toContain("signature-cards");
});
test("directory cursor links retain query, identity and page size without inventing totals or a terminal empty state", () => {
  const home = createHomePage("en", "signature"), ref = reference("doctor", content("doctor"));
  const page: M4PublicList = { schemaVersion: 4, locale: "en", kind: "doctor", canonicalUrl: "http://localhost:5892/clinic-a/en/bac-si", config: home.config, items: [{ ...ref, legacy: false, promotionState: null }], nextCursor: "sealed.next_123" };
  const query = { q: "care", pageSize: 6, cursor: "previous", referenceKind: "specialty" as const, referenceId: ids.asset }, html = renderToStaticMarkup(<SignatureListing page={page} tenant="clinic-a" kind="doctor" locale="en" query={query} alternates={[]}/>);
  expect(html).toContain('name="pageSize"'); expect(html).toContain("1 item on this page"); expect(html).toContain("pageSize=6"); expect(html).toContain("cursor=sealed.next_123"); expect(html).toContain("First page"); expect(html).not.toContain("previous&amp;"); expect(html).toContain(`referenceId=${ids.asset}`);
  const empty = renderToStaticMarkup(<SignatureListing page={{ ...page, items: [] }} tenant="clinic-a" kind="doctor" locale="en" query={{}} alternates={[]}/>); expect(empty).toContain("Continue to the next page"); expect(empty).toContain("Next page"); expect(empty).not.toContain("return later");
});
test("signature resource routing uses family details while both retained themes keep their renderer", () => {
  const doctor = content("doctor");
  for (const theme of ["clarity", "showcase", "signature"] as const) { const page: PublicM4Page = { ...createHomePage("en", theme), kind: "doctor", content: doctor, sections: [] }; const html = renderToStaticMarkup(<BuilderPage tenant="clinic-a" page={page}/>); expect(html).toContain(theme === "signature" ? "signature-profile" : "builder-resource"); if (theme !== "signature") expect(html).not.toContain("signature-profile"); }
});
