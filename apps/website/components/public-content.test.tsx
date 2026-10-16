import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContentPublicMedia } from "../../api/src/contracts/m3";
import { ListingFilters, ListingPagination, PriceDisplay, PublicMedia } from "./public-content";
import { ConsultationForm } from "./consultation-form";

const before: ContentPublicMedia = { slot: "before", pairIndex: 0, caption: "Caption before", media: { assetId: "a1111111-1111-4111-8111-111111111111", revision: 1, alt: "Alt before", width: 800, height: 600, profile: "cover", path: "/api/public/content-media/controlled-before" } };
const after: ContentPublicMedia = { ...before, slot: "after", caption: "Caption after", media: { ...before.media, assetId: "b1111111-1111-4111-8111-111111111111", alt: "Alt after", path: "/api/public/content-media/controlled-after" } };

test("gallery rendering removes both images and all alt/caption text from incomplete or duplicate pairs", () => {
  for (const media of [[before], [after], [before, before, after], [before, { ...after, media: before.media }]]) {
    const html = renderToStaticMarkup(createElement(PublicMedia, { kind: "gallery", media }));
    expect(html).not.toContain("<img"); expect(html).not.toContain("Caption"); expect(html).not.toContain("Alt");
  }
});
test("gallery rendering preserves ordered before/after labels and uses the direct eligibility gateway", () => {
  const html = renderToStaticMarkup(createElement(PublicMedia, { kind: "gallery", media: [after, before] }));
  expect(html.indexOf("Alt before")).toBeLessThan(html.indexOf("Alt after"));
  expect(html).toContain("http://127.0.0.1:5890/api/public/content-media/controlled-before");
  expect(html).not.toContain("/_next/image"); expect(html).toContain("Caption before");
});
test("prices keep the from qualifier, both equal range endpoints and all decimal digits", () => {
  const from = renderToStaticMarkup(createElement(PriceDisplay, { price: { type: "from", amount: "999999999999999999999.123456", currency: "VND", unit: "răng" } }));
  expect(from).toContain("Từ 999.999.999.999.999.999.999,123456 VND / răng");
  const range = renderToStaticMarkup(createElement(PriceDisplay, { price: { type: "range", minimum: "1000000.50", maximum: "1000000.50", currency: "VND", unit: "răng" } }));
  expect(range).toContain("1.000.000,50 – 1.000.000,50 VND / răng");
});
test("consultation renders an optional eligible-location selector and keeps legacy forms without a location control", () => {
  const props = { tenantSlug: "clinic-a", serviceSlug: "service-a", publicationId: "b1111111-1111-4111-8111-111111111111" };
  const oldForm = renderToStaticMarkup(createElement(ConsultationForm, props));
  expect(oldForm).not.toContain("Cơ sở quan tâm");
  const form = renderToStaticMarkup(createElement(ConsultationForm, { ...props, locations: [{ id: "c1111111-1111-4111-8111-111111111111", publicationId: props.publicationId, name: "Cơ sở A", address: "Địa chỉ thử nghiệm" }] }));
  expect(form).toContain("Cơ sở quan tâm"); expect(form).toContain("Chưa chọn cơ sở"); expect(form).toContain("Cơ sở A — Địa chỉ thử nghiệm");
  expect(form).not.toContain('required=""');
});
test("reverse filters and pagination preserve resource identity without adding an exact publication filter", () => {
  const query = { referenceKind: "service" as const, referenceId: "a1111111-1111-4111-8111-111111111111" };
  const filters = renderToStaticMarkup(createElement(ListingFilters, { tenant: "clinic-a", kind: "doctor", query }));
  expect(filters).toContain('name="referenceId"'); expect(filters).not.toContain('name="referencePublicationId"');
  const pagination = renderToStaticMarkup(createElement(ListingPagination, { tenant: "clinic-a", kind: "doctor", query, nextCursor: "next-page" }));
  expect(pagination).toContain("referenceKind=service"); expect(pagination).toContain(`referenceId=${query.referenceId}`); expect(pagination).toContain("cursor=next-page"); expect(pagination).not.toContain("referencePublicationId");
});
