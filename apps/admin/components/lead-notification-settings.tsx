"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { S05_ROUTES, type RecipientSettings, type RecipientSettingsInput, type RecipientSettingsResult } from "../../api/src/contracts/s05";
import { ApiError, apiRequest } from "../lib/access";
import { leadDenied, leadError } from "../lib/lead-presentation";
import { prepareVersionedOperation, versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { ReauthForm } from "./reauth-form";
import { useLeadAssignees } from "./use-lead-assignees";
import { requestGuardedAction, UnsavedChanges } from "./unsaved-changes";

export function LeadNotificationSettings() {
  const { membership, href } = useWorkspace(); const tenantId = membership!.tenantId;
  const [settings, setSettings] = useState<RecipientSettings | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState<unknown>(null); const [epoch, setEpoch] = useState(0); const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const unavailable = useCallback(() => { pending.current?.abort(); setSettings(null); setError(new ApiError(404)); setBusy(false); setNotice(""); }, []);
  const load = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setSettings(null); setBusy(true); setError(null);
    try { const next = await apiRequest<RecipientSettings>(S05_ROUTES.settings(tenantId), { signal: controller.signal }); if (!controller.signal.aborted) { setSettings(next); setEpoch(value => value + 1); } }
    catch (error) { if (!controller.signal.aborted) setError(error); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenantId]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load]);
  const saved = (next: RecipientSettings) => { setSettings(next); setEpoch(value => value + 1); setNotice(`Đã lưu người nhận thông báo · Phiên bản ${next.version}.`); };
  return <><div className="page-head"><div><div className="eyebrow">Thiết lập / Thông báo</div><h1>Người nhận yêu cầu tư vấn</h1><p>Chọn quản trị viên nhận thông báo tiếp nhận yêu cầu mới.</p></div></div><Link className="inline-link" href={href("/cms/settings")} prefetch={false}>Trở về cài đặt website</Link>{notice && <p className="notice" role="status">{notice}</p>}{busy ? <ShellState kind="loading" title="Đang tải người nhận" description="Đang kiểm tra quyền truy cập hiện tại."/> : error ? <ShellState kind={leadDenied(error) ? "denied" : "error"} title="Chưa thể tải người nhận" description={leadError(error)}><button className="btn" onClick={() => void load()}>Thử lại</button></ShellState> : settings && <RecipientEditor key={`${tenantId}:${settings.version}:${epoch}`} tenantId={tenantId} settings={settings} onUnavailable={unavailable} onSaved={saved} onRefresh={load}/>}</>;
}

function RecipientEditor({ tenantId, settings, onSaved, onUnavailable, onRefresh }: { tenantId: string; settings: RecipientSettings; onSaved: (settings: RecipientSettings) => void; onUnavailable: () => void; onRefresh: () => void }) {
  const { data } = useSession(); const admins = useLeadAssignees(tenantId, onUnavailable);
  const [mode, setMode] = useState(settings.mode); const [ids, setIds] = useState(settings.recipientUserIds);
  const [search, setSearch] = useState(""); const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false); const [unknown, setUnknown] = useState(false); const [conflict, setConflict] = useState(false); const [error, setError] = useState("");
  const [reauth, setReauth] = useState(false); const [latest, setLatest] = useState<RecipientSettings | null>(null);
  const attempt = useRef<RecipientSettingsInput | null>(null); const request = useRef<AbortController | null>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  const normalizedIds = mode === "selected" ? [...ids].sort() : [];
  const dirty = mode !== settings.mode || JSON.stringify(normalizedIds) !== JSON.stringify([...settings.recipientUserIds].sort()) || unknown;
  const disabled = busy || unknown || conflict || !settings.capabilities.canWrite;
  const selectedUsers = ids.map(id => admins.known.find(item => item.userId === id) ?? settings.recipients.find(item => item.userId === id));
  async function save() {
    if (busy || conflict || !settings.capabilities.canWrite || !data) return;
    if (!attempt.current && mode === "selected" && !ids.length) { setError("Chọn ít nhất một quản trị viên hợp lệ."); return; }
    if (!attempt.current && ids.length > 50) { setError("Chọn tối đa 50 quản trị viên."); return; }
    const body = prepareVersionedOperation(attempt.current, { mode, recipientUserIds: normalizedIds }, settings.version);
    attempt.current = body; const controller = new AbortController(); request.current = controller; const timer = setTimeout(() => controller.abort(), 15_000); setBusy(true); setError("");
    try {
      const result = await apiRequest<RecipientSettingsResult>(S05_ROUTES.settings(tenantId), { method: "PUT", csrf: data.csrfToken, body, signal: controller.signal });
      if (!alive.current) return; attempt.current = null; onSaved(result.settings);
    } catch (error) {
      if (!alive.current) return;
      if (leadDenied(error)) { onUnavailable(); return; }
      const failure = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown); setUnknown(failure.unknown); if (!failure.retain) attempt.current = null;
      setConflict(error instanceof ApiError && error.status === 409); setReauth(error instanceof ApiError && error.code === "REAUTH_REQUIRED");
      setError(failure.unknown ? error instanceof ApiError && error.code === "REAUTH_REQUIRED" ? "Xác thực lại để kiểm tra kết quả của cùng thao tác. Lựa chọn và mã thao tác ban đầu được giữ nguyên." : "Chưa xác định cấu hình đã được lưu hay chưa. Lựa chọn của bạn được giữ lại. Thử lại cùng thao tác để kiểm tra kết quả." : error instanceof ApiError && error.code === "RECIPIENT_UNAVAILABLE" ? "Có người nhận không còn đủ điều kiện. Lựa chọn được giữ lại. Kiểm tra bản hiện tại và quản trị viên hợp lệ." : leadError(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  async function compare() {
    setBusy(true); try { const next = await apiRequest<RecipientSettings>(S05_ROUTES.settings(tenantId)); if (alive.current) setLatest(next); }
    catch (error) { if (alive.current) { setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  return <><UnsavedChanges dirty={dirty} description="Lựa chọn đang soạn hoặc thao tác chưa xác định kết quả sẽ không được giữ trên trang mới. Kiểm tra cấu hình đã lưu trước khi gửi lại." continueLabel="Tiếp tục chỉnh sửa"/><section className="panel notification-settings"><div className="panel-head"><h2>Người nhận thông báo</h2><button className="btn" disabled={busy} onClick={() => requestGuardedAction(onRefresh)}>Làm mới cấu hình</button></div><div className="panel-body">
    <p>Thông báo tiếp nhận không chứa tên, thông tin liên hệ hoặc lời nhắn của khách. Người nhận mở CMS bằng tài khoản đang có quyền truy cập.</p><p className="notice">Môi trường thử tại máy này chỉ ghi nhận thông báo cục bộ. Chưa gửi email thật.</p>
    {!settings.capabilities.canWrite && <p role="status" className="notice">Nha khoa đang tạm ngưng. Cấu hình chỉ đọc.</p>}
    {settings.needsConfiguration && <p role="status" className="notice error">Người nhận hiện tại chưa đủ điều kiện. Hãy chọn rõ quản trị viên hợp lệ. Hệ thống không tự chuyển sang người khác.</p>}
    <form className="form-stack" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="recipient-modes" disabled={disabled}><legend>Chế độ người nhận</legend><label><input type="radio" name="recipient-mode" value="default" checked={mode === "default"} onChange={() => setMode("default")}/>Quản trị viên đầu tiên của nha khoa</label><p className="field-help">{settings.defaultRecipient ? `${settings.defaultRecipient.name}${settings.defaultRecipient.eligible ? "" : " · Không còn đủ điều kiện"}` : "Chưa xác minh được quản trị viên đầu tiên. Chọn người nhận cụ thể."} Người nhận mặc định không thay đổi theo người phụ trách yêu cầu.</p><label><input type="radio" name="recipient-mode" value="selected" checked={mode === "selected"} onChange={() => setMode("selected")}/>Chọn quản trị viên cụ thể</label></fieldset>
    {mode === "selected" && <div className="recipient-options"><h3>Quản trị viên nhận thông báo</h3><p className="field-help">{ids.length} người đã chọn. Chỉ quản trị viên cùng nha khoa, tài khoản và quyền quản trị đang hoạt động, email đã xác minh.</p>
      {ids.length > 0 && <ul className="selected-recipients">{ids.map((id, index) => <li key={id}><span>{selectedUsers[index]?.name ?? "Quản trị viên đã chọn"}{selectedUsers[index] && "eligible" in selectedUsers[index] && !selectedUsers[index].eligible ? " · Không còn đủ điều kiện" : ""}</span><button className="inline-link" type="button" disabled={disabled} onClick={() => setIds(previous => previous.filter(value => value !== id))}>Bỏ chọn</button></li>)}</ul>}
      <div className="recipient-search"><label className="field">Tìm quản trị viên<input type="search" value={search} disabled={disabled} onChange={event => { setSearch(event.target.value); setSearchError(""); }}/></label><button className="btn" type="button" disabled={disabled || admins.busy} onClick={() => { const q = search.normalize("NFC").trim(); if (q && ([...q].length < 2 || [...q].length > 80)) { setSearchError("Nhập từ 2 đến 80 ký tự để tìm quản trị viên."); return; } void admins.load(null, q); }}>Tìm người nhận</button></div>
      {searchError && <p className="form-error" role="alert">{searchError}</p>}{admins.error && <p className="form-error" role="alert">{admins.error}</p>}{admins.busy && <p className="field-help" role="status">Đang tải quản trị viên hợp lệ…</p>}
      <fieldset disabled={disabled || admins.busy} className="recipient-checkboxes"><legend>Quản trị viên hợp lệ</legend>{admins.page.items.map(item => <label key={item.userId}><input type="checkbox" checked={ids.includes(item.userId)} onChange={event => setIds(previous => event.target.checked ? [...previous, item.userId] : previous.filter(id => id !== item.userId))}/><span>{item.name}<small>{item.email}</small></span></label>)}{!admins.busy && !admins.error && !admins.page.items.length && <p>Không tìm thấy quản trị viên phù hợp.</p>}</fieldset>{admins.page.nextCursor && <button className="btn" type="button" disabled={disabled || admins.busy} onClick={() => void admins.load(admins.page.nextCursor)}>Tải thêm quản trị viên</button>}
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}{unknown ? <button className="btn primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Đang kiểm tra…" : "Thử lại cùng thao tác"}</button> : <button className="btn primary" disabled={disabled || !dirty || mode === "selected" && !ids.length || mode === "default" && !settings.defaultRecipient?.eligible}>{busy ? "Đang lưu…" : "Lưu người nhận"}</button>}
    <p className="field-help">Phiên bản {settings.version}. Cần xác thực lại trong 5 phút khi lưu. Cấu hình mới áp dụng cho thông báo còn chờ, không gửi lại người đã thành công.</p></form>
    {reauth && <section className="reauth-panel"><h3>Xác thực lại để lưu người nhận</h3><ReauthForm purpose="Xác thực lại để lưu cấu hình người nhận yêu cầu tư vấn." onSuccess={() => { setError(""); setReauth(false); }}/></section>}
    {conflict && <button className="btn" disabled={busy} onClick={() => void compare()}>Đối chiếu cấu hình hiện tại</button>}{latest && <div className="notice"><p>Cấu hình hiện tại · Phiên bản {latest.version} · {latest.mode === "default" ? "Quản trị viên đầu tiên" : `${latest.recipientUserIds.length} người nhận đã chọn`}</p><p>{latest.recipients.map(item => item.name).join(", ") || "Chưa có người nhận hợp lệ"}</p><button className="btn" onClick={() => requestGuardedAction(() => onSaved(latest))}>Dùng cấu hình hiện tại</button></div>}
  </div></section></>;
}
