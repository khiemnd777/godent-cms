"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { S05_ROUTES, type LeadDetail, type LeadHistoryPage } from "../../api/src/contracts/s05";
import { apiRequest } from "../lib/access";
import { historySummary, leadDate, leadDenied, leadError } from "../lib/lead-presentation";

export function LeadHistory({ tenantId, lead, onUnavailable }: { tenantId: string; lead: LeadDetail; onUnavailable: () => void }) {
  const [page, setPage] = useState<LeadHistoryPage>({ items: [], nextCursor: null });
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: string | null = null) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    try {
      const next = await apiRequest<LeadHistoryPage>(`${S05_ROUTES.history(tenantId, lead.id)}?pageSize=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal: controller.signal });
      if (!controller.signal.aborted) setPage(previous => ({ items: cursor ? [...previous.items, ...next.items] : next.items, nextCursor: next.nextCursor }));
    } catch (error) { if (!controller.signal.aborted) { setPage({ items: [], nextCursor: null }); setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenantId, lead.id, onUnavailable]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load, lead.version]);
  return <section aria-label="Lịch sử hoạt động"><h3>Lịch sử hoạt động</h3>{error ? <div role="alert"><p className="form-error">{error}</p><button className="btn" type="button" onClick={() => void load()}>Thử lại lịch sử</button></div> : <div className="timeline">{page.items.map(event => <div className="timeline-item" key={event.id}><strong>{historySummary(event)}</strong>{event.kind === "note" && <p>{event.payload.text}</p>}{event.kind === "contact" && <p>{event.payload.summary}</p>}{event.kind === "reopen" && <p>{event.payload.reason}</p>}<small>{leadDate(event.createdAt)} · {event.actor.name} · Phiên bản {event.version}</small></div>)}{!page.nextCursor && !busy && <div className="timeline-item">Tiếp nhận từ website<small>{leadDate(lead.createdAt)} · Website</small></div>}</div>}{busy && <p role="status" className="field-help">Đang tải lịch sử…</p>}{page.nextCursor && <button className="btn" type="button" disabled={busy} onClick={() => void load(page.nextCursor)}>Xem hoạt động trước</button>}</section>;
}
