import { expect, test } from "bun:test";
import type { ContentDraft } from "../../api/src/contracts/m3";
import { emptyContent } from "./content-input";
import { permissionRefreshState } from "./content-permission-refresh";
const content = { ...emptyContent("case"), title: "Ca thử", slug: "ca-thu" };
const canonical: ContentDraft = { id: "case-a", tenantId: "tenant-a", kind: "case", version: 2, publicationVersion: 1, publicationRevision: 3, publishedVersion: 2, activePublication: false, slugLocked: true, updatedAt: "2026-10-16T00:00:00Z", content };
test("permission refresh takes current publication metadata without a page reload", () => {
  const result = permissionRefreshState(canonical, { content, body: "", dirty: false });
  expect(result.draft.activePublication).toBe(false); expect(result.draft.publicationRevision).toBe(3);
  expect(result.content).toEqual(canonical.content);
});
test("a late canonical refresh preserves input typed during the request", () => {
  const edited = { ...content, title: "Chưa lưu" }; const result = permissionRefreshState(canonical, { content: edited, body: "Nội dung chưa lưu", dirty: true });
  expect(result.draft.publicationRevision).toBe(3); expect(result.content.title).toBe("Chưa lưu"); expect(result.body).toBe("Nội dung chưa lưu");
});
