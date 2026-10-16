"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { S07_ROUTES, type MediaAccessResult, type ServiceMediaReference } from "../../api/src/contracts/s07";
import { apiRequest, errorText } from "../lib/access";
import { safeMediaAccess } from "../lib/editorial-state";
import { useSession } from "./session-provider";
export function MediaPreview({ tenantId, reference }: { tenantId: string; reference: ServiceMediaReference }) {
  const { data } = useSession(); const [access, setAccess] = useState<MediaAccessResult | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; const request = ++current.current;
    void Promise.resolve().then(async () => {
      if (!data || controller.signal.aborted) return; setAccess(null); setError(""); setBusy(true);
      try { const result = await apiRequest<MediaAccessResult>(S07_ROUTES.access(tenantId, reference.assetId), { method: "POST", csrf: data.csrfToken, signal: controller.signal, body: { revision: reference.revision, variant: "cover", purpose: "admin_preview" } }); if (controller.signal.aborted || request !== current.current) return; const remaining = Date.parse(result.expiresAt) - Date.now(); if (remaining <= 0) throw new Error("expired"); setAccess({ ...result, url: safeMediaAccess(result.url) }); timer = setTimeout(() => { setAccess(null); setError("Lượt xem ảnh đã hết hạn. Mở lại để kiểm tra quyền hiện tại."); }, Math.min(remaining, 60000)); }
      catch (error) { if (!controller.signal.aborted) setError(errorText(error)); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [tenantId, reference.assetId, reference.revision, data, attempt]);
  return <div className="media-preview">{access ? <Image unoptimized src={access.url} alt={reference.alt} width={800} height={500} onError={() => { setAccess(null); setError("Ảnh không còn khả dụng hoặc quyền truy cập đã thay đổi."); }}/> : busy ? <p role="status" className="field-help">Đang kiểm tra quyền xem ảnh…</p> : <><p className="field-help" role="status">{error || "Ảnh chưa được mở."}</p><button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>Mở lại ảnh</button></>}</div>;
}
