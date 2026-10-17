import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignatureCarousel, SignatureFrame } from "./signature-ui";
import { BuilderPage } from "./builder-page";
import { createHomePage, landingContext } from "../test-support/builder";
import type { BuilderContent, PublicM4Page } from "../../api/src/contracts/m4";

test("signature groups are buttons, resource links remain navigable, and search is scoped by its action", () => {
  const html = renderToStaticMarkup(<SignatureFrame name="Lac Van Dental" locale="en" homeHref="/lac-van/en" currentPath="/lac-van/en" searchHref="/lac-van/en" menu={[{ id: "services", label: "Services", children: [{ id: "implant", label: "Dental implants", href: "/lac-van/en/dich-vu/implant", children: [] }] }]} contacts={[]} footer="Clinic information" languages={[{ locale: "en", href: "/lac-van/en" }]}>Content</SignatureFrame>);
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('href="/lac-van/en/dich-vu/implant"');
  expect(html).toContain('action="/lac-van/en"');
  expect(html).not.toContain('href="#"');
  expect(html).toContain('aria-label="Open menu"');
});

test("carousel has one main heading, explicit selection and pause controls", () => {
  const html = renderToStaticMarkup(createElement(SignatureCarousel, { locale: "en", autoplay: true, slides: [{ id: "first", title: "A comfortable smile", text: "Individual dental care", image: createElement("img", { src: "/permitted-image", alt: "Clinic" }) }, { id: "second", title: "Care for every age", text: "Published content" }] }));
  expect((html.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1);
  expect(html).toContain('aria-label="Pause slides"');
  expect(html).toContain('aria-label="Show slide 2"');
  expect(html).toContain('aria-roledescription="carousel"');
  expect(html).toContain('hidden=""');
});
test("signature home shows one real compact consultation immediately after its hero and keeps source identity", () => {
  const page: PublicM4Page = createHomePage("en", "signature"), form = { ...landingContext("en"), sourceType: "home" as const };
  page.config!.content.signature = { navigation: [], headerLocation: null, footerLocations: [] };
  page.config!.signature = { navigation: [], headerLocation: null, footerLocations: [] };
  const carousel = { id: "campaign", type: "hero_carousel" as const, hidden: false, autoplay: false, intervalMs: 7000 as const, slides: [{ id: "first", title: "Personal dental care", text: "Comfortable care", image: null, action: null }] }, consultation = { id: "request", type: "consultation" as const, hidden: false, title: "Talk to our team", promotion: null, serviceOptions: [], locationOptions: [] }, services = { id: "services", type: "services" as const, hidden: false, title: "Dental services", references: [], required: false };
  (page.content as BuilderContent).sections = [carousel, services, consultation];
  page.sections = [{ section: carousel, slides: [{ id: "first", title: "Personal dental care", text: "Comfortable care", media: null, action: null }], action: null, media: null, references: [], form: null, promotion: null }, { section: services, action: null, media: null, references: [], form: null, promotion: null }, { section: consultation, action: null, media: null, references: [], form, promotion: null }]; page.form = form;
  const html = renderToStaticMarkup(createElement(BuilderPage, { tenant: "clinic-a", page }));
  expect(html.indexOf("Talk to our team")).toBeLessThan(html.indexOf("Dental services")); expect((html.match(/consultation-compact/g) ?? []).length).toBe(1); expect(html).toContain("Use email or add consultation details"); expect(html).toContain('class="signature-mobile-contact"'); expect(html).toContain('action="/clinic-a/en"'); expect(html).not.toContain("tim-kiem");
});
