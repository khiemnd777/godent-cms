import { describe, expect, it } from "bun:test";
import { editorialState, mediaUploadError, safeMediaAccess } from "./editorial-state";

describe("M2 editorial and media UI rules", () => {
  it("treats an inactive publication head as Draft while preserving its historical counter", () => {
    expect(editorialState({ activePublication: false, publicationVersion: 7, draftVersion: 2, publishedDraftVersion: 2, publishedSiteVersion: 3 }, 3, false)).toEqual({ active: false, pending: true, liveVersion: null, lastPublishedVersion: 7 });
  });
  it("shows pending only when the draft or site differs from an active publication", () => {
    const head = { activePublication: true, publicationVersion: 7, draftVersion: 2, publishedDraftVersion: 2, publishedSiteVersion: 3 };
    expect(editorialState(head, 3, false).pending).toBe(false);
    expect(editorialState(head, 4, false).pending).toBe(true);
    expect(editorialState(head, 3, true).pending).toBe(true);
  });
  it("rejects empty, oversize and unsupported local files without claiming a full decode", () => {
    expect(mediaUploadError({ size: 0, type: "image/png" })).not.toBe("");
    expect(mediaUploadError({ size: 5 * 1024 * 1024 + 1, type: "image/png" })).not.toBe("");
    expect(mediaUploadError({ size: 1, type: "image/svg+xml" })).not.toBe("");
    expect(mediaUploadError({ size: 5 * 1024 * 1024, type: "image/webp" })).toBe("");
  });
  it("allows signed media only through the configured API gateway", () => {
    expect(safeMediaAccess("http://127.0.0.1:5890/api/tenants/a/media/b/signed?token=synthetic")).toContain("127.0.0.1:5890");
    for (const path of ["https://external.invalid/image.png", "javascript:alert(1)", "http://127.0.0.1:5887/private-object", "http://127.0.0.1:5890/other"]) expect(() => safeMediaAccess(path)).toThrow();
  });
});
