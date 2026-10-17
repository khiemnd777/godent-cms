import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContentPublicMedia } from "../../api/src/contracts/m3";
import type { M4PrivateMedia } from "../../api/src/contracts/m4";
import { completeGalleryPairs, SignatureGallery } from "./signature-gallery";
const image = (slot: "before" | "after", assetId: string): ContentPublicMedia => ({ slot, pairIndex: 0, caption: `${slot} caption`, media: { assetId, revision: 1, alt: `${slot} image`, width: 800, height: 600, profile: "cover", path: `/api/public/builder-media/current/${assetId}/cover` } });
test("comparison suppresses incomplete, duplicate and identical-asset pairs before any caption is rendered", () => {
  const before = image("before", "asset-a"), after = image("after", "asset-b");
  expect(completeGalleryPairs([before, after])).toHaveLength(1);
  for (const media of [[before], [before, after, after], [before, image("after", "asset-a")]]) { expect(completeGalleryPairs(media)).toHaveLength(0); const html = renderToStaticMarkup(<SignatureGallery media={media} locale="en"/>); expect(html).not.toContain("before caption"); expect(html).not.toContain("after caption"); }
});
test("complete comparison offers a keyboard range and separate image enlargement controls", () => {
  const html = renderToStaticMarkup(<SignatureGallery media={[image("before", "asset-a"), image("after", "asset-b")]} locale="en"/>);
  expect(html).toContain('type="range"'); expect(html).toContain("Move the image comparison divider"); expect(html).toContain("Comparison image"); expect(html).toContain("http://127.0.0.1:5890/api/public/builder-media/");
});
test("facility comparisons use authored captions without claiming a clinical before and after result", () => {
  const before = { ...image("before", "asset-a"), caption: "Reception space" }, after = { ...image("after", "asset-b"), caption: "Private consultation space" };
  const html = renderToStaticMarkup(<SignatureGallery media={[before, after]} locale="en"/>);
  expect(html).toContain("Reception space"); expect(html).toContain("Private consultation space"); expect(html).not.toContain(">Before<"); expect(html).not.toContain(">After<");
});
test("private comparison uses signed access and suppresses both images and captions when either access expired", () => {
  const image = (slot: string, expiresAt: string): M4PrivateMedia => ({ slot, assetId: slot, revision: 1, alt: `Private ${slot}`, pairIndex: 0, caption: `Private caption ${slot}`, url: `http://127.0.0.1:5890/api/media/access/${slot}?signature=bounded`, expiresAt });
  const before = image("before", new Date(Date.now() + 30000).toISOString()), after = image("after", new Date(Date.now() + 30000).toISOString());
  const current = renderToStaticMarkup(<SignatureGallery privateMedia={[before, after]} locale="en"/>);
  expect(current).toContain("/api/media/access/before?signature=bounded"); expect(current).toContain('type="range"');
  const expired = renderToStaticMarkup(<SignatureGallery privateMedia={[before, { ...after, expiresAt: "2020-01-01T00:00:00.000Z" }]} locale="en"/>);
  expect(expired).not.toContain("Private caption"); expect(expired).not.toContain("Private before"); expect(expired).not.toContain("/api/media/access/"); expect(expired).toContain("comparison is no longer available");
});
