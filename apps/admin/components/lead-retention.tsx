"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Clock3 } from "lucide-react";
import type { LeadDetail } from "../../api/src/contracts/s05";
import { S06_ROUTES, type RetentionExtensionInput } from "../../api/src/contracts/s06";
import { ApiError } from "../lib/access";
import { leadDate, leadDenied, leadError } from "../lib/lead-presentation";
import { leadFromSnapshot, requestLeadSnapshot, type LeadSnapshot } from "../lib/lead-response";
import { useRetentionDeadline } from "./use-retention-deadline";
import { extensionInput } from "../lib/retention-input";
import { versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";
import { ReauthForm } from "./reauth-form";
import { requestGuardedAction } from "./unsaved-changes";

const noticeLabels = { not_due: "Chưa đến lịch cảnh báo", pending: "Đang chờ cảnh báo", processing: "Đang xử lý cảnh báo", blocked: "Cảnh báo đang bị chặn", captured: "Đã ghi nhận cảnh báo tại máy thử", failed: "Cảnh báo chưa hoàn tất" };
export function LeadRetention({ tenantId, lead, disabled, onDirty, onChanged, onUnavailable }: { tenantId: string; lead: LeadDetail; disabled: boolean; onDirty: (dirty: boolean) => void; onChanged: (snapshot: LeadSnapshot) => void; onUnavailable: (reason?: "expired") => void }) {
  const { data } = useSession(); const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [reauth, setReauth] = useState(false); const [unknown, setUnknown] = useState(false); const [conflict, setConflict] = useState(false); const [latestSnapshot, setLatestSnapshot] = useState<LeadSnapshot | null>(null);
  const latest = leadFromSnapshot(latestSnapshot);
  const attempt = useRef<RetentionExtensionInput | null>(null); const pending = useRef<AbortController | null>(null); const alive = useRef(true);
  useEffect(() => { onDirty(!!reason || !!expiry || unknown); return () => onDirty(false); }, [reason, expiry, unknown, onDirty]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); }; }, []);
  useRetentionDeadline(latestSnapshot?.deadline ?? Infinity, () => { setLatestSnapshot(null); onUnavailable("expired"); });
  async function submit(event?: FormEvent) {
    event?.preventDefault(); if (busy || conflict || !data) return; setError("");
    let command = attempt.current;
    if (!command) { try { command = { ...extensionInput(reason, expiry, lead.expiresAt), operationId: crypto.randomUUID(), expectedVersion: lead.version }; } catch (error) { setError((error as Error).message); return; } }
    attempt.current = command; const controller = new AbortController(); pending.current = controller; const timer = setTimeout(() => controller.abort(), 15000); setBusy(true);
    try { const snapshot = await requestLeadSnapshot(S06_ROUTES.extension(tenantId, lead.id), { method: "POST", csrf: data.csrfToken, body: command, signal: controller.signal }); if (alive.current) { attempt.current = null; if (!snapshot) { onUnavailable("expired"); return; } onChanged(snapshot); } }
    catch (error) {
      if (!alive.current) return;
      if (leadDenied(error)) { onUnavailable(); return; }
      if (error instanceof ApiError && error.code === "REAUTH_REQUIRED") { if (!unknown) attempt.current = null; setReauth(true); setError("Xác thực lại bằng mật khẩu để gia hạn. Nội dung đã nhập được giữ lại."); return; }
      const failure = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown);
      setUnknown(failure.unknown); if (!failure.retain) attempt.current = null; setConflict(error instanceof ApiError && error.status === 409);
      setError(failure.unknown ? "Chưa xác định kết quả. Thử lại cùng thao tác để kiểm tra; nội dung được giữ lại." : leadError(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  async function compare() {
    if (busy) return; setBusy(true); setLatestSnapshot(null); const controller = new AbortController(); pending.current = controller;
    try { const snapshot = await requestLeadSnapshot(`/api/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(lead.id)}`, { signal: controller.signal }); if (alive.current) { if (!snapshot) { onUnavailable("expired"); return; } setLatestSnapshot(snapshot); } }
    catch (error) { if (alive.current) { setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  function applyLatest() { if (!alive.current) return; if (!leadFromSnapshot(latestSnapshot)) { setLatestSnapshot(null); onUnavailable("expired"); return; } onChanged(latestSnapshot!); }
  return <section className="retention-section" aria-label="Thời hạn lưu"><h3><Clock3 size={15} aria-hidden="true"/>Thời hạn lưu</h3><dl className="lead-metadata"><div><dt>Thời hạn hiện tại</dt><dd><time dateTime={lead.expiresAt}>{leadDate(lead.expiresAt)}</time></dd></div><div><dt>Thời hạn theo hoạt động</dt><dd>{leadDate(lead.normalExpiresAt)}</dd></div>{lead.extensionExpiresAt && <div><dt>Đã gia hạn đến</dt><dd>{leadDate(lead.extensionExpiresAt)}</dd></div>}</dl><p className="field-help">Xem, ghi chú, phân công hoặc mở lại không kéo dài thời hạn lưu. Dữ liệu đang soạn sẽ đóng khi yêu cầu hết hạn.</p>{lead.retentionNotice && <p className="field-help" role="status">{noticeLabels[lead.retentionNotice.status]} · {leadDate(lead.retentionNotice.dueAt)}{lead.retentionNotice.status === "captured" && ` · ${lead.retentionNotice.captured}/${lead.retentionNotice.recipients} người nhận`}{lead.retentionNotice.status === "blocked" && ". Kiểm tra quản trị viên còn quyền truy cập."}</p>}<button className="btn" type="button" disabled={disabled || !lead.capabilities.canWrite} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Ẩn gia hạn" : "Gia hạn thời gian lưu"}</button>{open && <div className="form-stack retention-form"><form className="form-stack" onSubmit={event => void submit(event)}><label className="field">Lý do gia hạn<textarea required maxLength={2000} rows={3} disabled={busy || unknown || conflict} value={reason} onChange={event => setReason(event.target.value)}/></label><label className="field">Thời hạn mới<input type="datetime-local" required disabled={busy || unknown || conflict} value={expiry} onChange={event => setExpiry(event.target.value)}/><span className="field-help">Giờ trên thiết bị của bạn. Chọn thời điểm sau thời hạn hiện tại.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn" disabled={busy || reauth || conflict || disabled || !lead.capabilities.canWrite}>{busy ? "Đang kiểm tra…" : unknown ? "Thử lại cùng thao tác gia hạn" : "Xác nhận gia hạn"}</button>{conflict && <button className="btn" type="button" disabled={busy} onClick={() => void compare()}>Đối chiếu thời hạn hiện tại</button>}{latest && <div className="notice"><p>Phiên bản {latest.version} · Thời hạn {leadDate(latest.expiresAt)}. Nội dung gia hạn của bạn vẫn được giữ lại.</p><button className="btn" type="button" onClick={() => requestGuardedAction(applyLatest)}>Dùng bản hiện tại</button></div>}</form>{reauth && <ReauthForm purpose="Xác thực lại để gia hạn thời gian lưu yêu cầu." onSuccess={() => { setReauth(false); setError(""); }}/>}</div>}</section>;
}
