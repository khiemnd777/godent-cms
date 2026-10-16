"use client";
import { initialQuotaInput } from "../lib/m5-input";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, Plus, Search, Shield, ShieldCheck } from "lucide-react";
import { apiRequest, errorText, type InvitationSummary, type TenantSummary } from "../lib/access";
import { useSession } from "./session-provider";
import { usePrivatePage } from "./use-private-page";
import { ReauthForm } from "./reauth-form";
import { ShellState } from "./shell-state";

export function PlatformTenants() {
  const { data } = useSession();
  const tenants = usePrivatePage<TenantSummary>("/api/platform/tenants");
  const [creating, setCreating] = useState(false);
  const [initialMode, setInitialMode] = useState<"" | "monitor" | "enforced">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ tenant: TenantSummary; invitation: InvitationSummary } | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => { if (creating) nameInput.current?.focus(); }, [creating]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    let initialQuotaPolicy;
    try { initialQuotaPolicy = initialQuotaInput(values); }
    catch { setError("Chọn chế độ hạn mức. Nếu áp dụng, nhập ít nhất một giới hạn số nguyên từ 0."); return; }
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError(""); setCreated(null);
    try {
      const result = await apiRequest<{ tenant: TenantSummary; invitation: InvitationSummary }>("/api/platform/tenants", { method: "POST", csrf: data!.csrfToken, body: { name: String(values.get("name") ?? "").trim(), initialAdminEmail: String(values.get("email") ?? "").trim(), initialQuotaPolicy }, signal: controller.signal });
      if (controller.signal.aborted) return;
      form.reset(); setInitialMode(""); setCreated(result); setCreating(false); await tenants.reload();
    } catch (error) { if (!controller.signal.aborted) setError(errorText(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <><div className="page-head"><div><div className="eyebrow">Không gian nền tảng</div><h1>Nha khoa</h1><p>Quản lý các website nha khoa trên nền tảng Godent.</p></div><button className="btn primary" onClick={() => setCreating(true)} disabled={creating}><Plus size={15}/>Thêm nha khoa</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}{created && <div className="notice" role="status"><strong>Đã tạo {created.tenant.name}.</strong><p>Lời mời quản trị ban đầu đã được gửi đến {created.invitation.email}. Người nhận cần xác minh email và chấp nhận lời mời để tham gia.</p></div>}
    {creating && <section className="panel section-gap"><div className="panel-head"><h2><Building2 size={17}/>Nha khoa mới</h2></div><div className="panel-body"><form className="form-stack bounded-form" onSubmit={submit}><label className="field">Tên nha khoa<input ref={nameInput} name="name" required maxLength={160} autoComplete="organization"/></label><label className="field">Email quản trị viên ban đầu<input name="email" type="email" required maxLength={254} autoComplete="email"/></label><label className="field">Chế độ hạn mức ban đầu<select name="mode" required value={initialMode} disabled={busy} onChange={event => setInitialMode(event.target.value as "monitor" | "enforced")}><option value="" disabled>Chọn chế độ trước khi bàn giao</option><option value="monitor">Theo dõi, chưa chặn tăng</option><option value="enforced">Áp dụng hạn mức</option></select></label>{initialMode === "enforced" && <><label className="field">Số nội dung tối đa<input name="contentItems" type="number" min={0} step={1} disabled={busy}/></label><label className="field">Dung lượng ảnh tối đa (byte)<input name="mediaBytes" type="number" min={0} step={1} disabled={busy}/></label><p className="field-help">Nhập ít nhất một giới hạn cụ thể. Để trống dimension chưa bật; số 0 chặn tăng mới. Không có mức mặc định.</p></>}<p className="field-help">Lời mời có hiệu lực 24 giờ. Tạo nha khoa không xuất bản website hoặc cấp quyền xem nội dung riêng cho quản trị nền tảng.</p><label className="check-field"><input type="checkbox" required/>Tôi xác nhận tên nha khoa và email được cấp quyền quản trị ban đầu.</label><div className="buttons"><button className="btn primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo và gửi lời mời"}</button><button type="button" className="btn" disabled={busy} onClick={() => setCreating(false)}>Hủy</button></div></form><details className="reauth-details"><summary>Xác thực lại trước khi tạo nha khoa</summary><div className="bounded-form"><ReauthForm/></div></details></div></section>}
    <section className="panel" aria-label="Danh sách nha khoa"><div className="toolbar"><label className="search"><Search size={16}/><input type="search" aria-label="Tìm nha khoa" placeholder="Tìm kiếm chưa khả dụng" disabled title="Danh sách hiện hỗ trợ tải thêm; tìm kiếm sẽ được bổ sung sau."/></label><select className="select" aria-label="Lọc trạng thái nha khoa" disabled defaultValue=""><option value="">Tất cả trạng thái</option></select><span className="right-label">{tenants.items.length} nha khoa đang hiển thị</span></div>
      {tenants.busy && !tenants.items.length ? <ShellState kind="loading" title="Đang tải nha khoa" description="Đang kiểm tra quyền quản trị nền tảng."/> : tenants.error ? <div className="panel-body"><p className="form-error" role="alert">{tenants.error}</p><button className="btn" onClick={() => void tenants.reload()}>Thử lại</button></div> : !tenants.items.length ? <ShellState title="Chưa có nha khoa" description="Tạo nha khoa và gửi lời mời cho quản trị viên ban đầu."/> : <div className="table-wrap"><table className="tenant-table data-table"><thead><tr><th scope="col">Nha khoa</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th><th scope="col">Website</th></tr></thead><tbody>{tenants.items.map(tenant => <tr key={tenant.id}><td data-label="Nha khoa"><strong>{tenant.name}</strong><small className="identifier">{tenant.id}</small></td><td data-label="Trạng thái"><span className={`tag ${tenant.status === "active" ? "green" : "gray"}`}>{tenant.status === "active" ? "Đang hoạt động" : "Tạm dừng"}</span></td><td data-label="Ngày tạo">{new Date(tenant.createdAt).toLocaleDateString("vi-VN")}</td><td data-label="Website"><Link className="btn" href={`/platform/limits?${new URLSearchParams({ tenant: tenant.id })}`} prefetch={false}>Hạn mức &amp; vòng đời</Link></td></tr>)}</tbody></table></div>}
      <div className="footer-row"><span>{tenants.cursor ? "Còn nha khoa để tải" : tenants.items.length ? "Đã hiển thị hết danh sách" : "Danh sách nha khoa"}</span>{tenants.cursor && <button className="btn" disabled={tenants.busy} onClick={() => void tenants.more()}>{tenants.busy ? "Đang tải…" : "Tải thêm nha khoa"}</button>}</div></section>
    <div className="context-note"><Shield size={14}/><span>Quản trị nền tảng chỉ quản lý thông tin nha khoa. Nội dung riêng và yêu cầu tư vấn vẫn cần quyền quản trị trong từng nha khoa.</span></div></>;
}

export function PlatformAccounts() {
  const { data, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const userId = String(values.get("userId") ?? "").trim();
    setError(""); setNotice("");
    if (userId !== String(values.get("confirmUserId") ?? "").trim()) { setError("Hai mã tài khoản phải trùng khớp."); return; }
    const controller = new AbortController(); mutation.current = controller; setBusy(true);
    try {
      await apiRequest(`/api/platform/users/${encodeURIComponent(userId)}/disable`, { method: "POST", csrf: data!.csrfToken, body: {}, signal: controller.signal });
      if (controller.signal.aborted) return;
      form.reset(); setNotice("Đã vô hiệu hóa tài khoản. Các phiên và quyền truy cập của tài khoản không còn hiệu lực."); await refresh();
    } catch (error) { if (!controller.signal.aborted) setError(`${errorText(error)} Mỗi nha khoa phải còn ít nhất một quản trị viên đang hoạt động.`); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <><div className="page-head"><div><div className="eyebrow">Không gian nền tảng</div><h1>Tài khoản quản trị</h1><p>Vô hiệu hóa tài khoản theo mã đã được xác minh.</p></div></div><div className="section-stack"><section className="panel"><div className="panel-head"><h2><Shield size={17}/>Vô hiệu hóa tài khoản</h2></div><div className="panel-body"><p>Thao tác áp dụng cho mọi nha khoa và mọi phiên của tài khoản. Hệ thống từ chối nếu bất kỳ nha khoa nào mất quản trị viên cuối cùng. Kiểm tra đúng mã tài khoản trước khi tiếp tục.</p><form className="form-stack bounded-form" onSubmit={disable}><label className="field">Mã tài khoản<input name="userId" required maxLength={128} pattern="[A-Za-z0-9_-]+" autoComplete="off"/></label><label className="field">Nhập lại mã tài khoản để xác nhận<input name="confirmUserId" required maxLength={128} pattern="[A-Za-z0-9_-]+" autoComplete="off"/></label><label className="check-field"><input type="checkbox" required/>Tôi xác nhận vô hiệu hóa tài khoản trên toàn nền tảng.</label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}<button className="btn" disabled={busy}>{busy ? "Đang xử lý…" : "Vô hiệu hóa tài khoản"}</button></form></div></section><section className="panel"><div className="panel-head"><h2><ShieldCheck size={17}/>Xác thực thao tác nhạy cảm</h2></div><div className="panel-body bounded-form"><ReauthForm/></div></section></div></>;
}
