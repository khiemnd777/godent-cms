import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { M4_KINDS, m4PublicPath, type M4Content, type M4Kind, type M4Locale, type PublicM4Page, type SitePresentation } from "../../api/src/contracts/m4";
import { parseM4Content } from "../../api/src/contracts/m4-validation";
import { createHomePage, ids, landingContext, testDoc } from "../test-support/builder";
import { BuilderPage } from "./builder-page";
import { BuilderConsultationForm } from "./builder-consultation-form";
import { BuilderListing } from "./builder-listing";

function contentFor(kind: M4Kind): M4Content {
  const base = { slug: "resource-a", title: `${kind} title`, summary: "Published summary", body: testDoc, seo: { title: "", description: "" }, references: [] };
  if (["home", "page", "landing"].includes(kind)) return parseM4Content(kind, { kind, slug: kind === "home" ? "home" : "resource-a", title: base.title, summary: base.summary, seo: base.seo, sections: [] });
  if (kind === "service") return parseM4Content(kind, { slug: base.slug, title: base.title, summary: base.summary, body: base.body, seo: base.seo, coverImage: null });
  if (kind === "gallery") return { ...base, kind, pairs: [] };
  const extra = kind === "doctor" ? { professionalTitle: "Dentist", credentials: ["Provided qualification"], languages: ["English"], image: null } : kind === "location" ? { address: "1 Clinic Street", phone: "", email: "", openingHours: [], mapUrl: "" } : kind === "price" ? { references: [{ kind: "service", id: ids.resource, publicationId: ids.publication }], price: { type: "exact", amount: "999999999999999999999.123456", currency: "VND", unit: "tooth" }, inclusions: "Included care", notes: "Published conditions" } : kind === "case" ? { image: null } : kind === "testimonial" ? { quote: "Provided experience", displayName: "Synthetic visitor", attribution: "Published attribution", image: null } : kind === "article" ? { attribution: "Published author", image: null } : kind === "promotion" ? { startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-11-01T00:00:00.000Z", authoredTimezone: "Asia/Ho_Chi_Minh", conditions: "Selected services only" } : {};
  return parseM4Content(kind, { ...base, kind, ...extra });
}
function pageFor(kind: M4Kind, locale: M4Locale, theme: SitePresentation["theme"]): PublicM4Page {
  const page = createHomePage(locale, theme), content = contentFor(kind), url = "http://localhost:5892" + m4PublicPath("clinic-a", locale, kind, kind === "home" ? "home" : "resource-a");
  return { ...page, kind, content, canonicalUrl: url, sections: [], alternates: [{ locale, url, publicationId: ids.publication }], promotionState: kind === "promotion" ? "active" : null };
}
test("both themes render every approved page family in each locale without a placeholder branch", () => {
  for (const kind of M4_KINDS) for (const locale of ["vi", "en"] as const) for (const theme of ["clarity", "showcase"] as const) {
    const html = renderToStaticMarkup(createElement(BuilderPage, { page: pageFor(kind, locale, theme), tenant: "clinic-a" }));
    expect(html).toContain(`theme-${theme}`); expect(html).toContain(`${kind} title`); expect((html.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1);
    expect(html).not.toContain("/_next/image");
    if (kind === "price" && locale === "en") expect(html).toContain("999,999,999,999,999,999,999.123456 VND / tooth");
  }
});
test("image-led listings use the current gateway projection instead of asset references or a cache", () => {
  const page = pageFor("doctor", "en", "showcase"), content = contentFor("doctor");
  const image = { assetId: ids.asset, revision: 1, alt: "Current portrait", profile: "cover" as const, width: 800, height: 600, path: `/api/public/builder-media/${ids.tenant}/doctor/${ids.resource}/en/${ids.publication}/${ids.asset}/1/cover` };
  const html = renderToStaticMarkup(createElement(BuilderListing, { tenant: "clinic-a", locale: "en", kind: "doctor", query: {}, page: { schemaVersion: 4, locale: "en", kind: "doctor", config: page.config, canonicalUrl: "http://localhost:5892/clinic-a/en/bac-si", nextCursor: null, items: [{ id: ids.resource, kind: "doctor", locale: "en", title: "doctor title", slug: "resource-a", content, publicationId: ids.publication, publicationVersion: 1, path: "/clinic-a/en/bac-si/resource-a", legacy: false, media: [{ slot: "image", media: image }], references: [], promotionState: null }] } }));
  expect(html).toContain("theme-showcase"); expect(html).toContain("Current portrait"); expect(html).toContain("http://127.0.0.1:5890/api/public/builder-media/"); expect(html).not.toContain("/_next/image");
});
test("an inactive promotion removes a landing offer action and form while retaining information", () => {
  const page = pageFor("landing", "en", "showcase"), promotionPage = pageFor("promotion", "en", "showcase");
  const promotion = { id: ids.resource, kind: "promotion" as const, locale: "en" as const, publicationId: ids.publication, publicationVersion: 1, publishedAt: promotionPage.publishedAt, canonicalUrl: promotionPage.canonicalUrl, content: promotionPage.content, references: [], media: [], promotionState: "expired" as const };
  page.sections = [{ section: { id: "hero", type: "hero", hidden: false, title: "Landing information", text: "Published page information", image: null, action: { label: "Request this offer", target: { kind: "landing", id: ids.resource, locale: "en" }, allowViFallback: false } }, action: { label: "Request this offer", path: "/clinic-a/en/landing/resource-a", actualLocale: "en", fallback: false }, references: [], media: null, promotion: null, form: null }, { section: { id: "form", type: "consultation", hidden: false, title: "Consultation", promotion: { kind: "promotion", id: ids.resource, publicationId: ids.publication }, serviceOptions: [], locationOptions: [] }, action: null, references: [], media: null, promotion, form: null }];
  const html = renderToStaticMarkup(createElement(BuilderPage, { page, tenant: "clinic-a" }));
  expect(html).toContain("This promotion has ended"); expect(html).toContain("Selected services only"); expect(html).not.toContain("Request this offer"); expect(html).not.toContain("<form");
});
test("EN form uses server-selected consent copy and does not invent a service selection", () => {
  const html = renderToStaticMarkup(createElement(BuilderConsultationForm, { tenant: "clinic-a", slug: "campaign-a", context: landingContext("en") }));
  expect(html).toContain("I agree that the clinic may use the information I provided"); expect(html).toContain("does not confirm an appointment"); expect(html).toContain("Preferred contact language"); expect(html).not.toContain("Service of interest"); expect(html).not.toContain("Họ tên");
});
