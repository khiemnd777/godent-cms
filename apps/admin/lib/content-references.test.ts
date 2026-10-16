import { expect, test } from "bun:test";
import { chooseReference, moveReference } from "./content-references";
const a = { kind: "faq" as const, id: "a", publicationId: "old-a" }; const b = { kind: "faq" as const, id: "b", publicationId: "old-b" };
test("selecting a newer publication replaces only the chosen reference in place", () => {
  const selected = [a, b]; const result = chooseReference(selected, { ...a, publicationId: "new-a" });
  expect(result).toEqual([{ ...a, publicationId: "new-a" }, b]); expect(selected).toEqual([a, b]);
});
test("preserves ordered references and rejects self links", () => {
  expect(moveReference([a, b], 1, -1)).toEqual([b, a]);
  expect(moveReference([a, b], 0, -1)).toEqual([a, b]);
  expect(() => chooseReference([], a, "a")).toThrow();
});
