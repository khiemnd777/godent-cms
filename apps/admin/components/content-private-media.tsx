"use client";
import type { DentalContent } from "../../api/src/contracts/m3";
import { MediaPreview } from "./media-preview";
export function ContentPrivateMedia({ tenantId, content }: { tenantId: string; content: DentalContent }) {
  if (content.kind === "gallery") return <section className="content-related"><h3>Cặp ảnh trước và sau</h3>{content.pairs.map((pair, index) => <section className="gallery-pair" key={index}><h4>Cặp {index + 1}</h4><div className="gallery-image-grid">{(["before", "after"] as const).map(side => <figure key={side}><figcaption>{side === "before" ? "Trước" : "Sau"}</figcaption><MediaPreview tenantId={tenantId} reference={pair[side]}/>{pair[side].caption && <p>{pair[side].caption}</p>}</figure>)}</div></section>)}</section>;
  return "image" in content && content.image ? <MediaPreview tenantId={tenantId} reference={content.image}/> : null;
}
