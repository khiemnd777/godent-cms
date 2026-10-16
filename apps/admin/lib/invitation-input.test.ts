import { expect, test } from "bun:test";
import { INVITATION_NAME_LIMIT, invitationNameError } from "./invitation-input";
test("enforces invitation registration name boundaries before credential creation", () => {
  expect(INVITATION_NAME_LIMIT).toBe(100);
  expect(invitationNameError("a".repeat(100))).toBe("");
  expect(invitationNameError("a".repeat(101))).not.toBe("");
  expect(invitationNameError("  ")).not.toBe("");
});
