import { expect, test } from "bun:test";
import { type DentalContent } from "../../api/src/contracts/m3";
import { contentInputError, emptyContent } from "./content-input";
const prepared = <T extends DentalContent>(value: T): T => ({ ...value, title: "Nội dung thử", slug: "noi-dung-thu" });
test("starts new price empty and requires an explicit amount and one service", () => {
  const content = prepared(emptyContent("price")); if (content.kind !== "price") throw new Error("Wrong type");
  expect(contentInputError(content)).not.toBe("");
  const references = [{ kind: "service" as const, id: "service-a", publicationId: "publication-a" }];
  expect(contentInputError({ ...content, references, price: { type: "exact", amount: "0", currency: "VND", unit: "lần" } })).toBe("");
  expect(contentInputError({ ...content, references, price: { type: "exact", amount: "01", currency: "VND", unit: "lần" } })).not.toBe("");
  expect(contentInputError({ ...content, references: [...references, { ...references[0], id: "service-b" }], price: { type: "exact", amount: "1", currency: "VND", unit: "lần" } })).not.toBe("");
});
test("checks location intervals, breaks and closed days before sending", () => {
  const content = prepared(emptyContent("location")); if (content.kind !== "location") throw new Error("Wrong type");
  const base = { ...content, address: "Địa chỉ tổng hợp" };
  expect(contentInputError({ ...base, openingHours: [{ day: 1, closed: false, intervals: [{ opens: "08:00", closes: "12:00" }, { opens: "13:00", closes: "17:00" }] }] })).toBe("");
  expect(contentInputError({ ...base, openingHours: [{ day: 1, closed: false, intervals: [{ opens: "08:00", closes: "12:00" }, { opens: "11:00", closes: "17:00" }] }] })).not.toBe("");
  expect(contentInputError({ ...base, openingHours: [{ day: 1, closed: true, intervals: [{ opens: "08:00", closes: "12:00" }] }] })).not.toBe("");
});
test("gallery cannot save an incomplete pair or duplicate image", () => {
  const content = prepared(emptyContent("gallery")); if (content.kind !== "gallery") throw new Error("Wrong type");
  const before = { assetId: "a", revision: 1, alt: "Trước", caption: "" }; const after = { assetId: "b", revision: 1, alt: "Sau", caption: "" };
  expect(contentInputError({ ...content, pairs: [{ before, after }] })).toBe("");
  expect(contentInputError({ ...content, pairs: [{ before, after: { ...after, assetId: "" } }] })).not.toBe("");
  expect(contentInputError({ ...content, pairs: [{ before, after: { ...after, assetId: "a" } }] })).not.toBe("");
});
