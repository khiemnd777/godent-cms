"use client";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { S07_ROUTES, type MediaAccessResult, type MediaAsset } from "../../api/src/contracts/s07";
import { apiRequest } from "../lib/access";
import { safeMediaAccess } from "../lib/editorial-state";
import { useSession } from "./session-provider";

/** Thumbnail access follows the same current private permission path as the full media preview. */
export function MediaThumbnail({ tenantId, asset }: { tenantId: string; asset: MediaAsset }) {
  const { data } = useSession(), container = useRef<HTMLSpanElement>(null), [visible, setVisible] = useState(false), [access, setAccess] = useState<(MediaAccessResult & { identity: string }) | null>(null), [unavailable, setUnavailable] = useState(false), csrf = data?.csrfToken, identity = `${tenantId}:${asset.id}:${asset.revision}`;
  useEffect(() => { const element = container.current; if (!element || asset.state !== "ready") return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "120px" }); observer.observe(element); return () => observer.disconnect(); }, [asset.state]);
  useEffect(() => {
    if (!visible || !csrf || asset.state !== "ready" || asset.tenantId !== tenantId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    void apiRequest<MediaAccessResult>(S07_ROUTES.access(tenantId, asset.id), { method: "POST", csrf, signal: controller.signal, body: { revision: asset.revision, variant: "cover", purpose: "admin_preview" } }).then(result => {
      if (controller.signal.aborted) return; const remaining = Date.parse(result.expiresAt) - Date.now(); if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Image access unavailable");
      setAccess({ ...result, identity, url: safeMediaAccess(result.url) }); setUnavailable(false); timer = setTimeout(() => { setAccess(null); setUnavailable(true); }, Math.min(remaining, 60000));
    }).catch(() => { if (!controller.signal.aborted) { setAccess(null); setUnavailable(true); } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [visible, csrf, tenantId, asset.id, asset.revision, asset.state, asset.tenantId, identity]);
  return <span className={`media-thumbnail${unavailable ? " unavailable" : ""}`} ref={container}>{access && access.identity === identity && asset.tenantId === tenantId && asset.state === "ready" ? <Image unoptimized src={access.url} alt={`Ảnh ${asset.id.slice(0, 8)}`} width={180} height={120} onError={() => { setAccess(null); setUnavailable(true); }}/> : <ImageIcon size={26} aria-hidden="true"/>}{unavailable && <span className="media-thumbnail-status">Mở lại ảnh</span>}</span>;
}
