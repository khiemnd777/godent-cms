"use client";
import { useEffect, useState } from "react";
import type { M4Locale, M4PrivateMedia } from "../../api/src/contracts/m4";
import type { PublicMediaBlock } from "../../api/src/contracts/s07";
import { localMediaUrl } from "../lib/local-media-url";
export type SignatureImageSource = PublicMediaBlock | M4PrivateMedia;
export function signatureImageCurrent(image: SignatureImageSource, now = Date.now()) { return !("expiresAt" in image) || Number.isFinite(Date.parse(image.expiresAt)) && Date.parse(image.expiresAt) > now; }
export function SignatureImage({ image, locale, onUnavailable, className = "public-image", eager = false }: { image: SignatureImageSource; locale: M4Locale; onUnavailable?: () => void; className?: string; eager?: boolean }) {
  const [openedAt] = useState(() => Date.now()), [unavailable, setUnavailable] = useState(false); let src: string | null = null;
  try { src = localMediaUrl("url" in image ? image.url : image.path); } catch { /* Never load a private capability or public projection from another origin. */ }
  const expiresAt = "expiresAt" in image ? image.expiresAt : null;
  useEffect(() => {
    if (!expiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => { const remaining = Date.parse(expiresAt) - Date.now(); if (!Number.isFinite(remaining) || remaining <= 0) { setUnavailable(true); onUnavailable?.(); } else timer = setTimeout(check, Math.min(remaining, 60000)); };
    check(); return () => clearTimeout(timer);
  }, [expiresAt, onUnavailable]);
  if (!src || unavailable || !signatureImageCurrent(image, openedAt)) return <p className="public-empty">{locale === "en" ? "This image is unavailable. Reopen the page or preview to check current access." : "Ảnh hiện không khả dụng. Mở lại trang hoặc bản xem trước để kiểm tra quyền hiện tại."}</p>;
  // Avoid an image cache: every view uses the current gateway or expiring private access.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={image.alt} width={"width" in image ? image.width : 1000} height={"height" in image ? image.height : 650} loading={eager ? "eager" : "lazy"} onError={() => { setUnavailable(true); onUnavailable?.(); }}/>;
}
