import { expect, test } from "bun:test";
import type { M4PrivateMedia } from "../../api/src/contracts/m4";
import { privateGalleryPairs } from "./builder-preview-state";
const image = (slot: string, assetId: string, pairIndex = 0): M4PrivateMedia => ({ slot, assetId, revision: 1, pairIndex, alt: `${slot} image`, url: "/api/media/private", expiresAt: "2026-10-16T00:01:00.000Z" });
test("private gallery preview cannot leave half a pair, caption or duplicate image", () => {
  expect(privateGalleryPairs([image("before", "a")])).toEqual([]);
  expect(privateGalleryPairs([image("before", "a"), image("after", "a")])).toEqual([]);
  expect(privateGalleryPairs([image("before", "a"), image("after", "b")])[0].after.assetId).toBe("b");
  expect(privateGalleryPairs([image("before", "a"), image("before", "c"), image("after", "b")])).toEqual([]);
});
