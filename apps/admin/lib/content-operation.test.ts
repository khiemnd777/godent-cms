import { expect, test } from "bun:test";
import { contentSaveFailure } from "./content-operation";
test("a rejected create stays editable and discards its known failed command", () => {
  expect(contentSaveFailure(409, undefined, false, false)).toEqual({ unknown: false, retain: false, conflict: false });
});
test("an existing version conflict requires comparison and a transport failure keeps its command", () => {
  expect(contentSaveFailure(409, undefined, false, true)).toEqual({ unknown: false, retain: false, conflict: true });
  expect(contentSaveFailure(undefined, undefined, false, false)).toEqual({ unknown: true, retain: true, conflict: false });
  expect(contentSaveFailure(403, "REAUTH_REQUIRED", true, false)).toEqual({ unknown: true, retain: true, conflict: false });
});

test("keeps quota capacity denial distinct from a saved-version conflict", () => {
  const result = contentSaveFailure(409, "QUOTA_EXCEEDED", false, true);
  expect(result.conflict).toBe(false); expect(result.unknown).toBe(false); expect(result.retain).toBe(false);
});
