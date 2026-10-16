import { expect, test } from "bun:test";
import { serviceValidation, suggestedSlug, validSlug } from "./service-input";
test("suggests a stable Vietnamese service slug without reserving platform names", () => {
  expect(suggestedSlug("Chăm sóc răng định kỳ")).toBe("cham-soc-rang-dinh-ky");
  expect(validSlug("cms")).toBe(false); expect(validSlug("dich-vu")).toBe(false);
  expect(validSlug("rang--dinh-ky")).toBe(false); expect(validSlug("rang-dinh-ky")).toBe(true);
  expect(validSlug("a".repeat(63))).toBe(true); expect(validSlug("a".repeat(64))).toBe(false);
});
test("validates service content independently of title-derived routes", () => {
  const service = { slug: "cham-soc", title: "Chăm sóc", summary: "", seo: { title: "", description: "" }, body: { type: "doc" as const, version: 1 as const, blocks: [] } };
  expect(serviceValidation(service)).toBe(""); expect(serviceValidation({ ...service, title: " " })).not.toBe("");
  expect(serviceValidation({ ...service, summary: "x".repeat(321) })).not.toBe("");
});
