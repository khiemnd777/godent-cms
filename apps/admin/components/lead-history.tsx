"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { S05_ROUTES, type LeadDetail } from "../../api/src/contracts/s05";
import { historyFromSnapshot, mergeHistorySnapshot, requestLeadHistorySnapshot, type LeadHistorySnapshot } from "../lib/lead-response";
import { historySummary, leadDate, leadDenied, leadError } from "../lib/lead-presentation";
import { useRetentionDeadline } from "./use-retention-deadline";

export function LeadHistory({ tenantId, lead, onUnavailable }: { tenantId: string; lead: LeadDetail; onUnavailable: (reason?: "expired") => void }) {
  const [snapshot, setSnapshot] = useState<LeadHistorySnapshot | null>(null);
  const page = historyFromSnapshot(snapshot);
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: string | null = null) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    try {
      const next = await requestLeadHistorySnapshot(`${S05_ROUTES.history(tenantId, lead.id)}?pageSize=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal: controller.signal });
      if (!controller.signal.aborted) { if (!next) { setSnapshot(null); onUnavailable("expired"); return; } setSnapshot(previous => mergeHistorySnapshot(previous, next, !!cursor)); }
    } catch (error) { if (!controller.signal.aborted) { setSnapshot(null); setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenantId, lead.id, onUnavailable]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load, lead.version]);
  useRetentionDeadline(snapshot?.deadline ?? Infinity, () => { pending.current?.abort(); setSnapshot(null); onUnavailable("expired"); });
  return <section aria-label="Lịch sử hoạt động"><h3>Lịch sử hoạt động</h3>{error ? <div role="alert"><p className="form-error">{error}</p><button className="btn" type="button" onClick={() => void load()}>Thử lại lịch sử</button></div> : <div className="timeline">{page?.items.map(event => <div className="timeline-item" key={event.id}><strong>{historySummary(event)}</strong>{event.kind === "note" && <p>{event.payload.text}</p>}{event.kind === "contact" && <p>{event.payload.summary}</p>}{event.kind === "reopen" && <p>{event.payload.reason}</p>}{event.kind === "retention_extended" && <p>{event.payload.reason}<br/>Thời hạn mới: {leadDate(event.payload.expiresAt)}</p>}<small>{leadDate(event.createdAt)} · {event.actor.name} · Phiên bản {event.version}</small></div>)}{page && !page.nextCursor && !busy && <div className="timeline-item">Tiếp nhận từ website<small>{leadDate(lead.createdAt)} · Website</small></div>}</div>}{busy && <p role="status" className="field-help">Đang tải lịch sử…</p>}{page?.nextCursor && <button className="btn" type="button" disabled={busy} onClick={() => void load(page.nextCursor)}>Xem hoạt động trước</button>}</section>;
}
