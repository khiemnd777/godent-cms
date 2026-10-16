import { afterEach, expect, spyOn, test } from "bun:test";
import { contentPublicPath, M3_LIMITS } from "../../api/src/contracts/m3";
import { parsePublicQuery, publicListingPath, readPublicContentList, readPublicContentPage, reverseReferenceQuery } from "./public-content";
import { parsePublicContentPage, parsePublicPrice, parsePublicServiceLinks } from "./public-content-validation";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const id = "a1111111-1111-4111-8111-111111111111", publicationId = "b1111111-1111-4111-8111-111111111111";
const emptyBody = { type: "doc", version: 1, blocks: [] };
const site = { name: "Nha khoa thử nghiệm", footer: { intro: "", body: emptyBody } };
const content = { kind: "specialty", slug: "chuyen-khoa-a", title: "Chuyên khoa A", summary: "Giới thiệu", body: emptyBody, seo: { title: "", description: "" }, references: [] };
const page = { schemaVersion: 3, locale: "vi", id, kind: "specialty", publicationId, publicationVersion: 1, publishedAt: "2026-10-16T00:00:00Z", canonicalUrl: "http://localhost:5892/clinic-a/chuyen-khoa/chuyen-khoa-a", site, content, references: [], media: [] };

test("M3 SSR reads the fixed anonymous no-store API and validates the tenant-specific canonical path", async () => {
  let url = "", init: RequestInit | undefined;
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[input, options]: Parameters<typeof fetch>) => { url = String(input); init = options; return Response.json(page); }, { preconnect: originalFetch.preconnect }));
  expect((await readPublicContentPage("clinic-a", "specialty", "chuyen-khoa-a"))?.content.title).toBe("Chuyên khoa A");
  expect(url).toBe("http://127.0.0.1:5890/api/public/content/clinic-a/specialty/chuyen-khoa-a");
  expect(init?.credentials).toBe("omit"); expect(init?.cache).toBe("no-store"); expect(init?.redirect).toBe("error");
  expect([...new Headers(init?.headers).keys()]).toEqual(["accept"]);
  expect(() => parsePublicContentPage({ ...page, canonicalUrl: "https://forged.invalid/page" }, "clinic-a", "specialty", "chuyen-khoa-a")).toThrow();
});
test("public responses reject private fields, draft shapes, invalid media and cross-tenant links", () => {
  expect(() => parsePublicContentPage({ ...page, evidenceReference: "private" }, "clinic-a", "specialty", "chuyen-khoa-a")).toThrow();
  expect(() => parsePublicContentPage({ ...page, content: { ...content, draftVersion: 2 } }, "clinic-a", "specialty", "chuyen-khoa-a")).toThrow();
  expect(() => parsePublicContentPage({ ...page, media: [{ slot: "image", media: { assetId: id, revision: 1, alt: "Ảnh", width: 1, height: 1, profile: "cover", path: "https://forged.invalid/image.png" } }] }, "clinic-a", "specialty", "chuyen-khoa-a")).toThrow();
  expect(() => parsePublicContentPage({ ...page, references: [{ kind: "specialty", id, publicationId, title: content.title, slug: content.slug, path: contentPublicPath("clinic-b", "specialty", content.slug), publicationVersion: 1, content, references: [], media: [] }] }, "clinic-a", "specialty", "chuyen-khoa-a")).toThrow();
});
test("public list validates real card identities and distinguishes empty/not-found/outage", async () => {
  const list = { schemaVersion: 3, locale: "vi", kind: "specialty", canonicalUrl: "http://localhost:5892/clinic-a/chuyen-khoa", site, items: [], nextCursor: null };
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(list)).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect((await readPublicContentList("clinic-a", "specialty"))?.items).toEqual([]);
  expect(await readPublicContentList("clinic-a", "specialty")).toBeNull();
  await expect(readPublicContentList("clinic-a", "specialty")).rejects.toThrow("temporarily unavailable");
  fetcher.mockClear(); expect(await readPublicContentList("../clinic-b", "specialty")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
test("public response reads enforce the shared byte limit before parsing the DTO", async () => {
  const list = { schemaVersion: 3, locale: "vi", kind: "specialty", canonicalUrl: "http://localhost:5892/clinic-a/chuyen-khoa", site, items: [], nextCursor: null };
  const payload = JSON.stringify(list);
  spyOn(globalThis, "fetch").mockResolvedValue(new Response(" ".repeat(M3_LIMITS.publicBytes - new TextEncoder().encode(payload).byteLength + 1) + payload));
  await expect(readPublicContentList("clinic-a", "specialty")).rejects.toThrow("Invalid public publication");
});
test("filter URLs preserve one exact published reference and encode search without forwarding arbitrary parameters", () => {
  const query = parsePublicQuery({ q: "  răng & lợi ", referenceKind: "specialty", referenceId: id, referencePublicationId: publicationId, token: "untrusted" });
  expect(publicListingPath("clinic-a", "service", query)).toBe(`/clinic-a/dich-vu?q=r%C4%83ng+%26+l%E1%BB%A3i&referenceKind=specialty&referenceId=${id}&referencePublicationId=${publicationId}`);
  expect(() => parsePublicQuery({ q: ["one", "two"] })).toThrow();
  expect(() => parsePublicQuery({ referenceKind: "specialty" })).toThrow();
  expect(() => parsePublicQuery({ referencePublicationId: publicationId })).toThrow();
});
test("reverse discovery after P2 republish requests eligible relationships by resource and keeps P1 pins intact", async () => {
  const currentPage = { kind: "service" as const, id, publicationId: "c1111111-1111-4111-8111-111111111111" };
  const oldPinnedReference = { kind: "service", id, publicationId };
  const query = reverseReferenceQuery(currentPage);
  expect(query).toEqual({ referenceKind: "service", referenceId: id });
  const path = publicListingPath("clinic-a", "doctor", query);
  expect(path).toBe(`/clinic-a/bac-si?referenceKind=service&referenceId=${id}`);
  expect(parsePublicQuery(Object.fromEntries(new URL(path, "http://localhost:5892").searchParams))).toEqual(query);
  const requests: URL[] = [];
  const card = { id: "d1111111-1111-4111-8111-111111111111", kind: "doctor" as const, title: "Bác sĩ có dịch vụ liên quan", slug: "bac-si-a", summary: "", path: "/clinic-a/bac-si/bac-si-a", publicationId: "e1111111-1111-4111-8111-111111111111", publicationVersion: 1 };
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[input]: Parameters<typeof fetch>) => {
    const url = new URL(String(input)); requests.push(url);
    const selectedPublication = url.searchParams.get("referencePublicationId");
    return Response.json({ schemaVersion: 3, locale: "vi", kind: "doctor", canonicalUrl: "http://localhost:5892/clinic-a/bac-si", site, items: selectedPublication && selectedPublication !== oldPinnedReference.publicationId ? [] : [card], nextCursor: null });
  }, { preconnect: originalFetch.preconnect }));
  expect((await readPublicContentList("clinic-a", "doctor", query))?.items).toEqual([card]);
  expect(requests[0].searchParams.has("referencePublicationId")).toBe(false);
  expect(oldPinnedReference.publicationId).toBe(publicationId);
});
test("prices preserve exact decimal strings and reject reversed ranges and mixed shapes", () => {
  expect(parsePublicPrice({ type: "range", minimum: "999999999999999999999.123456", maximum: "999999999999999999999.123456", currency: "VND", unit: "răng" }).type).toBe("range");
  expect(() => parsePublicPrice({ type: "range", minimum: "1.000001", maximum: "1", currency: "VND", unit: "răng" })).toThrow();
  expect(() => parsePublicPrice({ type: "from", amount: "1", maximum: "2", currency: "VND", unit: "răng" })).toThrow();
});
test("consultation options reject locations not explicitly present among eligible service references", () => {
  expect(() => parsePublicServiceLinks({ serviceId: id, publicationId, references: [], locations: [{ id, publicationId, name: "Không áp dụng", address: "Địa chỉ thử nghiệm" }] }, "clinic-a")).toThrow();
});
test("public media accepts only a scoped path for the owning resource, publication and exact asset revision", () => {
  const tenantId = "c1111111-1111-4111-8111-111111111111", assetId = "d1111111-1111-4111-8111-111111111111";
  const doctor = { ...content, kind: "doctor", professionalTitle: "Bác sĩ", credentials: [], languages: ["Tiếng Việt"], image: { assetId, revision: 1, alt: "Ảnh bác sĩ thử nghiệm" } };
  const media = { slot: "image", media: { ...doctor.image, width: 800, height: 600, profile: "cover", path: `/api/public/content-media/${tenantId}/${id}/${publicationId}/${assetId}/1/cover` } };
  const doctorPage = { ...page, kind: "doctor", content: doctor, media: [media], canonicalUrl: "http://localhost:5892/clinic-a/bac-si/chuyen-khoa-a" };
  expect(parsePublicContentPage(doctorPage, "clinic-a", "doctor", "chuyen-khoa-a").media[0].media.path).toBe(media.media.path);
  expect(() => parsePublicContentPage({ ...doctorPage, media: [{ ...media, media: { ...media.media, path: media.media.path.replace(publicationId, id) } }] }, "clinic-a", "doctor", "chuyen-khoa-a")).toThrow();
  expect(() => parsePublicContentPage({ ...doctorPage, media: [{ ...media, media: { ...media.media, alt: "Different snapshot alt" } }] }, "clinic-a", "doctor", "chuyen-khoa-a")).toThrow();
});
test("a gallery publication remains readable after all withdrawn pairs have been pruned", () => {
  const galleryPage = { ...page, kind: "gallery", content: { ...content, kind: "gallery", pairs: [] }, canonicalUrl: "http://localhost:5892/clinic-a/truoc-sau/chuyen-khoa-a" };
  expect(parsePublicContentPage(galleryPage, "clinic-a", "gallery", "chuyen-khoa-a").media).toEqual([]);
});
