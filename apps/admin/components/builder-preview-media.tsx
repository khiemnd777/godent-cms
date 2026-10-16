"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ContentPublicMedia } from "../../api/src/contracts/m3";
import type { M4PrivateMedia, M4Locale } from "../../api/src/contracts/m4";
import { safeMediaAccess } from "../lib/editorial-state";
import { privateGalleryPairs } from "../lib/builder-preview-state";

export function PrivateClosureImage({ image, onUnavailable }: { image: M4PrivateMedia; onUnavailable?: () => void }) {
  const [openedAt] = useState(() => Date.now()); const [unavailable, setUnavailable] = useState(false); let src: string | null = null;
  try { src = safeMediaAccess(image.url); } catch { /* Never send preview access to an untrusted origin. */ }
  const current = Number.isFinite(Date.parse(image.expiresAt)) && Date.parse(image.expiresAt) > openedAt;
  useEffect(() => { const remaining = Date.parse(image.expiresAt) - Date.now(); const timer = setTimeout(() => { setUnavailable(true); onUnavailable?.(); }, Math.max(0, Math.min(remaining, 60000))); return () => clearTimeout(timer); }, [image.expiresAt, onUnavailable]);
  return !unavailable && current && src ? <Image className="bp-image" unoptimized src={src} alt={image.alt} width={1000} height={650} onError={() => { setUnavailable(true); onUnavailable?.(); }}/> : <p className="field-help">Lượt xem ảnh đã hết hạn hoặc ảnh không còn khả dụng. Mở lại bản xem trước để kiểm tra quyền hiện tại.</p>;
}
function PrivatePair({ before, after, locale }: { before: M4PrivateMedia; after: M4PrivateMedia; locale: M4Locale }) {
  const [unavailable, setUnavailable] = useState(false);
  return unavailable ? <p className="field-help">Cặp ảnh không còn đủ điều kiện trong lượt xem này.</p> : <div className="bp-pair">{[{ image: before, label: locale === "en" ? "Before" : "Trước" }, { image: after, label: locale === "en" ? "After" : "Sau" }].map(({ image, label }) => <figure key={image.assetId}><PrivateClosureImage image={image} onUnavailable={() => setUnavailable(true)}/><figcaption>{label}{image.caption && ` · ${image.caption}`}</figcaption></figure>)}</div>;
}
export function PrivateClosureMedia({ media, gallery, locale }: { media: M4PrivateMedia[]; gallery: boolean; locale: M4Locale }) {
  if (gallery) return privateGalleryPairs(media).map(pair => <PrivatePair key={`${pair.index}:${pair.before.assetId}:${pair.after.assetId}`} before={pair.before} after={pair.after} locale={locale}/>);
  return media.filter(item => item.slot === "image" || item.slot === "cover").map(item => <figure key={`${item.assetId}:${item.revision}`}><PrivateClosureImage image={item}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>);
}
export function ReferenceMedia({ media, gallery, locale }: { media: ContentPublicMedia[]; gallery: boolean; locale: M4Locale }) {
  const render = (item: ContentPublicMedia, label?: string) => <figure key={`${item.slot}:${item.media.assetId}`}><Image className="bp-image" unoptimized src={safeMediaAccess(item.media.path)} alt={item.media.alt} width={item.media.width} height={item.media.height}/>{(label || item.caption) && <figcaption>{label}{item.caption && ` · ${item.caption}`}</figcaption>}</figure>;
  if (!gallery) { const item = media.find(item => item.slot === "image" || item.slot === "cover"); return item ? render(item) : null; }
  return [...new Set(media.flatMap(item => item.pairIndex === undefined ? [] : [item.pairIndex]))].sort((a, b) => a - b).map(index => { const before = media.filter(item => item.pairIndex === index && item.slot === "before"), after = media.filter(item => item.pairIndex === index && item.slot === "after"); return before.length === 1 && after.length === 1 && before[0].media.assetId !== after[0].media.assetId ? <div className="bp-pair" key={index}>{render(before[0], locale === "en" ? "Before" : "Trước")}{render(after[0], locale === "en" ? "After" : "Sau")}</div> : null; });
}
