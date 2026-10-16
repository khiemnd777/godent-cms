"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { M3_LIMITS, M3_ROUTES, type ContentDraft, type ContentPermission, type ContentPermissions, type ContentPermissionCommandResult } from "../../api/src/contracts/m3";
import { apiRequest, ApiError, errorText } from "../lib/access";
import { contentPermissionSelection } from "../lib/content-media";
import { permissionForRevision, permissionScopeKey } from "../lib/content-permission";
import { mergePermissionPage, mergePermissionRead, mergePermissionRecord, mergePermissionUpdates } from "../lib/permission-pages";
import { versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";
import { ReauthForm } from "./reauth-form";

export function ContentPermissionsPanel({ draft, disabled, onDirty, onConflict, onApplied, historicalOnly = false }: { draft: ContentDraft; disabled: boolean; onDirty: (dirty: boolean) => void; onConflict: () => void; onApplied: () => Promise<void>; historicalOnly?: boolean }) {
  const { data } = useSession(); const path = M3_ROUTES.resource(draft.tenantId, draft.kind, draft.id);
  const [scopeKey, setScopeKey] = useState("text"); const { scopes, selected: chosenScope } = contentPermissionSelection(draft.content, scopeKey);
  const [permissions, setPermissions] = useState<ContentPermissions>({ items: [], nextCursor: null }); const [evidence, setEvidence] = useState(""); const [withdraw, setWithdraw] = useState<ContentPermission | null>(null); const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [readError, setReadError] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reauth, setReauth] = useState(false); const [unknown, setUnknown] = useState(false); const [denied, setDenied] = useState(false);
  const pending = useRef<AbortController | null>(null); const refreshingRequest = useRef<AbortController | null>(null); const saving = useRef<AbortController | null>(null); const alive = useRef(true); const heading = useRef<HTMLHeadingElement>(null); const command = useRef<{ suffix: string; body: object } | null>(null);
  const observedVersion = useRef(draft.version); const readGeneration = useRef(0); const loaded = useRef(permissions);
  const dirty = !!evidence || !!reason || unknown;
  useEffect(() => { loaded.current = permissions; }, [permissions]);
  useEffect(() => { onDirty(dirty || busy); return () => onDirty(false); }, [dirty, busy, onDirty]);
  const invalidateReads = useCallback(() => { readGeneration.current++; pending.current?.abort(); refreshingRequest.current?.abort(); }, []);
  const load = useCallback(async (cursor: string | null = null, mode: "older" | "newest" = "newest") => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; const generation = readGeneration.current; setLoading(true); setReadError("");
    const query = new URLSearchParams({ pageSize: String(M3_LIMITS.permissionPageSize), ...(cursor ? { cursor } : {}) });
    try {
      const result = await apiRequest<ContentPermissions>(`${path}/permissions?${query}`, { signal: controller.signal });
      if (!controller.signal.aborted && generation === readGeneration.current) {
        setPermissions(previous => generation === readGeneration.current ? mergePermissionPage(previous, result, mode) : previous);
        setWithdraw(previous => { const next = result.items.find(item => item.id === previous?.id); return previous && next ? mergePermissionRecord(previous, next) : previous; }); setDenied(false);
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === readGeneration.current) {
        setReadError(errorText(error));
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { setPermissions({ items: [], nextCursor: null }); setWithdraw(null); setDenied(true); }
      }
    } finally { if (pending.current === controller && alive.current) setLoading(false); }
  }, [path, setWithdraw]);
  const refreshRows = useCallback(async (ids: string[]) => {
    if (!ids.length) return; refreshingRequest.current?.abort(); const controller = new AbortController(); refreshingRequest.current = controller; const generation = readGeneration.current; setRefreshing(true); const timer = setTimeout(() => controller.abort(), 15000);
    const queue = [...new Set(ids)]; let index = 0; let failure = "";
    const read = async () => {
      while (!controller.signal.aborted && generation === readGeneration.current && index < queue.length) {
        const permissionId = queue[index++];
        try {
          const result = await apiRequest<ContentPermission>(M3_ROUTES.permission(draft.tenantId, draft.kind, draft.id, permissionId), { signal: controller.signal });
          if (controller.signal.aborted || generation !== readGeneration.current) return;
          if (result.id !== permissionId || result.resourceId !== draft.id) throw new Error("Permission identity mismatch");
          setPermissions(previous => mergePermissionRead(previous, [result], generation, readGeneration.current));
          setWithdraw(previous => previous?.id === result.id ? mergePermissionRecord(previous, result) : previous);
        } catch (error) {
          if (controller.signal.aborted || generation !== readGeneration.current) return;
          failure = errorText(error);
          if (error instanceof ApiError && [401, 403].includes(error.status)) { setPermissions({ items: [], nextCursor: null }); setWithdraw(null); setDenied(true); controller.abort(); return; }
          if (error instanceof ApiError && error.status === 404) { setPermissions(previous => ({ ...previous, items: previous.items.filter(item => item.id !== permissionId) })); setWithdraw(previous => previous?.id === permissionId ? null : previous); }
        }
      }
    };
    try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, read)); }
    finally {
      clearTimeout(timer);
      if (refreshingRequest.current === controller && alive.current) {
        setRefreshing(false);
        if (generation === readGeneration.current) setReadError(failure || (controller.signal.aborted ? "Chưa thể cập nhật đầy đủ trạng thái quyền. Các quyền đã tải được giữ lại; thử làm mới quyền." : ""));
      }
    }
  }, [draft.tenantId, draft.kind, draft.id]);
  async function refreshAll() { const ids = permissions.items.map(item => item.id); invalidateReads(); const generation = readGeneration.current; await load(); if (alive.current && generation === readGeneration.current) await refreshRows(ids); }
  useEffect(() => { alive.current = true; void Promise.resolve().then(() => { if (alive.current) return load(); }); return () => { alive.current = false; invalidateReads(); saving.current?.abort(); }; }, [load, invalidateReads]);
  useEffect(() => {
    if (loading || refreshing || busy || unknown) return; const ids = permissions.items.filter(item => item.purge?.status === "pending").map(item => item.id); if (!ids.length) return;
    const timer = setTimeout(() => void refreshRows(ids), 2500); return () => clearTimeout(timer);
  }, [permissions.items, loading, refreshing, busy, unknown, refreshRows]);
  useEffect(() => {
    if (observedVersion.current === draft.version) return; observedVersion.current = draft.version; let active = true;
    void Promise.resolve().then(() => { if (!active) return; setNotice("Bản nháp đã thay đổi. Thông tin đang nhập được giữ lại; kiểm tra phiên bản và phạm vi trước khi ghi nhận quyền."); return refreshRows(loaded.current.items.map(item => item.id)); });
    return () => { active = false; };
  }, [draft.version, refreshRows]);
  async function mutate(suffix: string, body: object) {
    if (!data || busy || disabled) return; const captured = command.current ?? { suffix, body }; command.current = captured; invalidateReads(); const controller = new AbortController(); saving.current = controller; const timer = setTimeout(() => controller.abort(), 15000); setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<ContentPermissionCommandResult>(`${path}/${captured.suffix}`, { method: "POST", body: captured.body, csrf: data.csrfToken, signal: controller.signal });
      if (!alive.current) return;
      if (result.permission.resourceId !== draft.id) throw new Error("Permission identity mismatch");
      setPermissions(previous => mergePermissionUpdates(previous, [result.permission]));
      if (captured.suffix === "permissions") setEvidence("");
      if (captured.suffix === "permissions/withdrawal") { setReason(""); setWithdraw(previous => previous?.id === result.permission.id ? null : previous); }
      setUnknown(false); command.current = null;
      const changedScope = result.permission.scope;
      if (captured.suffix === "permissions/withdrawal" && changedScope.type === "asset") {
        const related = loaded.current.items.filter(item => item.id !== result.permission.id && item.scope.type === "asset" && item.scope.assetId === changedScope.assetId && item.scope.assetRevision === changedScope.assetRevision).map(item => item.id);
        await refreshRows(related);
      }
      await onApplied(); if (!alive.current) return; requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
      setNotice(captured.suffix === "permissions/withdrawal" ? "Đã thu hồi quyền. Quyền truy cập công khai và trạng thái vô hiệu hóa đường dẫn tài nguyên được kiểm tra riêng." : captured.suffix === "permissions/retry" ? "Đã yêu cầu thử lại vô hiệu hóa đường dẫn tài nguyên. Quyền công khai vẫn bị chặn." : "Đã ghi nhận quyền cho đúng nội dung, phiên bản và phạm vi đã chọn.");
    } catch (error) {
      if (!alive.current) return; const failure = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown); setUnknown(failure.unknown); if (!failure.retain) command.current = null; if (error instanceof ApiError && error.code === "REAUTH_REQUIRED") setReauth(true); if (error instanceof ApiError && error.status === 409) onConflict();
      if (error instanceof ApiError && [401, 403, 404].includes(error.status) && error.code !== "REAUTH_REQUIRED") { setPermissions({ items: [], nextCursor: null }); setWithdraw(null); setDenied(true); }
      setError(failure.unknown ? "Chưa xác định kết quả. Giữ nguyên thông tin và thử lại cùng thao tác." : error instanceof ApiError && error.status === 409 ? "Phiên bản hoặc quyền công bố đã thay đổi. Thông tin đang nhập được giữ lại. Đối chiếu bản hiện tại trước khi tiếp tục." : errorText(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  const locked = disabled || loading || busy || unknown || denied || reauth;
  const current = chosenScope ? permissionForRevision(permissions.items, draft.id, draft.version, chosenScope.scope) : undefined;
  return <section className="panel content-permissions"><div className="panel-head"><h2 ref={heading} tabIndex={-1}><ShieldCheck size={16}/>Quyền công bố</h2><button className="btn" type="button" disabled={loading || refreshing || busy || unknown} onClick={() => void refreshAll()}><RefreshCw size={14}/>Làm mới quyền</button></div><div className="panel-body form-stack"><p className="publish-note">{draft.content.title} · Bản nháp {draft.version}. Quyền chỉ áp dụng cho nội dung, phiên bản và tư liệu được chọn. Ca điều trị, gallery và đánh giá cần quyền cho nội dung chữ và từng ảnh, kể cả ảnh thông thường. Hồ sơ bác sĩ và bài viết dùng ảnh có nguồn gốc bệnh nhân cũng cần quyền cho ảnh đó. Quyền ảnh đại diện dịch vụ không thay thế quyền này.</p><p className="field-help">Trạng thái dưới đây theo dõi việc vô hiệu hóa đường dẫn của tài nguyên. Thu hồi toàn bộ ảnh và xử lý bản phát sinh được quản lý tại Thư viện hình ảnh.</p>{disabled && <p className="field-help">Lưu nội dung đang soạn trước khi ghi quyền. Bản đã lưu là căn cứ xác định phạm vi.</p>}{readError && <p className="form-error" role="alert">{readError}</p>}{refreshing && <p className="field-help" role="status">Đang cập nhật trạng thái các quyền đã tải…</p>}{error && <div className="notice error" role="alert"><p>{error}</p>{unknown && <button className="btn" type="button" disabled={busy} onClick={() => command.current && void mutate(command.current.suffix, command.current.body)}>Thử lại cùng thao tác quyền công bố</button>}</div>}{notice && <p className="notice" role="status">{notice}</p>}{reauth && <ReauthForm purpose="Xác thực lại để ghi nhận hoặc thu hồi quyền công bố." onSuccess={() => { setReauth(false); setError(""); }}/ >}{!denied && !historicalOnly && <form className="form-stack" onSubmit={event => { event.preventDefault(); if (!evidence.trim() || !chosenScope) return; void mutate("permissions", { operationId: crypto.randomUUID(), expectedVersion: draft.version, revision: draft.version, scope: chosenScope.scope, evidenceReference: evidence.trim() }); }}>{!scopes.length && <p className="field-help" role="status">Bản nháp hiện tại không có tư liệu để ghi nhận quyền. Bạn vẫn có thể xem, thu hồi và thử lại quyền của các phiên bản trước.</p>}<label className="field">Phạm vi tư liệu<select value={chosenScope ? permissionScopeKey(chosenScope.scope) : ""} disabled={locked || !!withdraw || !scopes.length} onChange={event => setScopeKey(event.target.value)}>{!chosenScope && <option value="">{scopes.length ? "Chọn lại phạm vi tư liệu" : "Không có tư liệu trong bản nháp"}</option>}{scopes.map(item => <option key={permissionScopeKey(item.scope)} value={permissionScopeKey(item.scope)}>{item.label}</option>)}</select></label>{current && <p className="field-help">Đã ghi nhận quyền đang có hiệu lực cho phạm vi này ở bản nháp {draft.version}.</p>}<label className="field">Tham chiếu bằng chứng riêng tư<input required value={evidence} maxLength={500} disabled={locked || !!current || !!withdraw || !scopes.length} onChange={event => setEvidence(event.target.value)}/><span className="field-help">Ghi mã hoặc tham chiếu hồ sơ đã có. Không nhập bệnh án, số điện thoại hoặc thông tin không cần thiết. Tham chiếu này chỉ dùng trong CMS.</span></label><div className="buttons"><button className="btn" disabled={locked || !!current || !!withdraw || !evidence.trim() || !chosenScope}>Ghi nhận quyền cho bản nháp {draft.version}</button>{evidence && <button className="btn" type="button" disabled={busy || unknown} onClick={() => setEvidence("")}>Xóa nội dung đang nhập</button>}</div></form>}{loading && <p role="status" className="field-help">Đang kiểm tra quyền đã ghi nhận…</p>}{!loading && !permissions.items.length && !denied && !readError && <p className="field-help">Chưa có quyền công bố được ghi nhận cho nội dung này.</p>}{permissions.items.map(permission => { const material = permission.scope.type === "text" ? "Nội dung chữ" : scopes.find(item => permissionScopeKey(item.scope) === permissionScopeKey(permission.scope))?.label ?? "Ảnh của phiên bản trước"; return <article className="permission-row form-stack" key={permission.id}><div className="content-inline-row"><h3>{material}</h3><span className={`tag ${permission.withdrawnAt ? "gray" : "green"}`}>{permission.withdrawnAt ? "Đã thu hồi" : "Đã ghi nhận"}</span></div><dl className="confirmation-identity"><div><dt>Phiên bản nội dung</dt><dd>{permission.revision}{permission.revision !== draft.version ? " · Phiên bản trước" : " · Bản nháp hiện tại"}</dd></div><div><dt>Tham chiếu bằng chứng</dt><dd>{permission.evidenceReference}</dd></div><div><dt>Ghi nhận lúc</dt><dd>{new Date(permission.grantedAt).toLocaleString("vi-VN")}</dd></div>{permission.withdrawnAt && <><div><dt>Thu hồi lúc</dt><dd>{new Date(permission.withdrawnAt).toLocaleString("vi-VN")}</dd></div><div><dt>Lý do</dt><dd>{permission.withdrawalReason}</dd></div></>}</dl>{permission.purge && <p className="field-help" role="status">Vô hiệu hóa đường dẫn tài nguyên: {permission.purge.status === "completed" ? "Đã hoàn tất" : permission.purge.status === "failed" ? "Thất bại, cần thử lại" : "Đang chờ xử lý"} · {permission.purge.attempts} lần thử. {permission.purge.status !== "completed" && "Quyền công khai vẫn bị chặn trong khi xử lý."}</p>}{permission.purge?.status === "failed" && <button className="btn" type="button" disabled={locked || dirty || !!withdraw} onClick={() => void mutate("permissions/retry", { operationId: crypto.randomUUID(), expectedVersion: draft.version, permissionId: permission.id })}>Thử lại vô hiệu hóa đường dẫn tài nguyên</button>}{!permission.withdrawnAt && <button className="btn danger" type="button" disabled={locked || !!evidence} onClick={() => { setWithdraw(permission); setReason(""); }}><ShieldOff size={14}/>Thu hồi quyền này</button>}</article>; })}{permissions.nextCursor && !denied && <div className="buttons"><button className="btn" type="button" disabled={loading || refreshing || busy || unknown} onClick={() => void load(permissions.nextCursor, "older")}>{loading ? "Đang tải quyền cũ hơn…" : "Tải quyền cũ hơn"}</button><span className="field-help">{permissions.items.length} quyền đã tải</span></div>}{withdraw && <form className="form-stack notice" onSubmit={event => { event.preventDefault(); if (!reason.trim()) return; void mutate("permissions/withdrawal", { operationId: crypto.randomUUID(), expectedVersion: draft.version, permissionId: withdraw.id, reason: reason.trim() }); }}><h3>Xác nhận thu hồi quyền</h3>{withdraw.withdrawnAt && <p className="field-help">Quyền này đã được thu hồi. Lý do bạn đang nhập được giữ lại.</p>}<p>{draft.content.title} · Bản {withdraw.revision} · {withdraw.scope.type === "text" ? "Nội dung chữ" : "Ảnh đã chọn"}. Thu hồi nội dung chữ sẽ chặn công khai toàn bộ tài nguyên. Thu hồi một ảnh trong cặp sẽ bỏ cả cặp ảnh trước/sau.</p><label className="field">Lý do thu hồi *<textarea required rows={3} value={reason} maxLength={500} disabled={locked} onChange={event => setReason(event.target.value)}/></label><div className="buttons"><button className="btn danger" disabled={locked || !reason.trim() || !!withdraw.withdrawnAt}>Xác nhận thu hồi quyền</button><button className="btn" type="button" disabled={busy || unknown} onClick={() => { setWithdraw(null); setReason(""); }}>Hủy thu hồi</button></div></form>}</div></section>;
}
