import { expect, test } from "bun:test";
import { DRAFT_LIMITS, draftValidation } from "./draft-input";

test("accepts the title and body contract boundaries", () => {
  expect(draftValidation("a".repeat(160), "b".repeat(20_000))).toBe("");
  expect(DRAFT_LIMITS).toEqual({ title: 160, body: 20_000 });
});
test("rejects oversize or empty drafts before transport", () => {
  expect(draftValidation("a".repeat(161), "")).not.toBe("");
  expect(draftValidation("title", "b".repeat(20_001))).not.toBe("");
  expect(draftValidation("  ", "")).not.toBe("");
  expect(draftValidation("title", "\0")).not.toBe("");
});
