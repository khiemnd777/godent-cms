"use client";
import { useTenantCapabilities } from "./tenant-capabilities";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MailPlus, ShieldCheck, Users } from "lucide-react";
import { apiRequest, errorText, tenantApi, type InvitationSummary, type MemberSummary } from "../lib/access";
import { useSession } from "./session-provider";
import { useWorkspace } from "./workspace";
import { usePrivatePage } from "./use-private-page";
import { ReauthForm } from "./reauth-form";
import { ShellState } from "./shell-state";

type Action = { kind: "member"; member: MemberSummary } | { kind: "resend" | "invitation"; invitation: InvitationSummary };
export function MemberAdministration() {
  const { businessWrite } = useTenantCapabilities(); const { data, refresh } = useSession();
  const { membership, href } = useWorkspace();
  const base = tenantApi(membership!.tenantId);
  const members = usePrivatePage<MemberSummary>(`${base}/members`);
  const invitations = usePrivatePage<InvitationSummary>(`${base}/invitations`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => { if (action) confirmation.current?.focus(); }, [action]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!businessWrite) return; const form = event.currentTarget; const email = String(new FormData(form).get("email") ?? "").trim();
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest<InvitationSummary>(`${base}/invitations`, { method: "POST", csrf: data!.csrfToken, body: { email }, signal: controller.signal });
      if (controller.signal.aborted) return;
      form.reset(); setNotice("Đã tạo lời mời. Liên kết xác minh được gửi qua email của hệ thống."); await invitations.reload();
    } catch (error) { if (!controller.signal.aborted) setError(errorText(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!businessWrite || !action) return;
    const controller = new AbortController(); mutation.current = controller;
    const endpoint = action.kind === "member" ? `${base}/members/${encodeURIComponent(action.member.userId)}` : `${base}/invitations/${encodeURIComponent(action.invitation.id)}${action.kind === "resend" ? "/resend" : ""}`;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest(endpoint, { method: action.kind === "resend" ? "POST" : "DELETE", csrf: data!.csrfToken, ...(action.kind === "resend" ? { body: {} } : {}), signal: controller.signal });
      if (controller.signal.aborted) return;
      const selfRevoked = action.kind === "member" && action.member.userId === data!.user.id;
      setNotice(action.kind === "resend" ? "Đã gửi lại lời mời. Liên kết cũ không còn hiệu lực." : "Đã thu hồi quyền hoặc lời mời đã chọn."); setAction(null);
      if (selfRevoked) await refresh(); else await Promise.all([members.reload(), invitations.reload()]);
    } catch (error) { if (!controller.signal.aborted) setError(`${errorText(error)} Nha khoa phải luôn còn ít nhất một quản trị viên đang hoạt động.`); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <><Link className="back-link" href={href("/cms/settings")} prefetch={false}>Cài đặt website</Link><div className="page-head"><div><div className="eyebrow">Thiết lập</div><h1>Thành viên & lời mời</h1><p>Quản trị viên của {membership!.tenantName}</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {action && <section className="panel confirmation-panel"><div className="panel-body"><h2 ref={confirmation} tabIndex={-1}>{action.kind === "member" ? "Thu hồi thành viên" : action.kind === "resend" ? "Gửi lại lời mời" : "Thu hồi lời mời"}</h2><p>{action.kind === "member" ? action.member.email : action.invitation.email}</p><p>{action.kind === "member" ? "Thành viên sẽ mất quyền truy cập nha khoa này. Quản trị viên cuối cùng không thể bị thu hồi." : action.kind === "resend" ? "Liên kết cũ sẽ hết hiệu lực. Một liên kết mới có hiệu lực 24 giờ sẽ được gửi đến đúng email này." : "Liên kết mời sẽ không thể được sử dụng để tham gia nha khoa."}</p><form onSubmit={confirm} className="form-stack"><label className="check-field"><input type="checkbox" required/>Tôi xác nhận thao tác cho email nêu trên.</label><div className="buttons"><button className="btn primary" disabled={!businessWrite || busy}>{busy ? "Đang xử lý…" : "Xác nhận"}</button><button className="btn" type="button" disabled={!businessWrite || busy} onClick={() => setAction(null)}>Hủy</button></div></form></div></section>}
    <div className="section-stack"><section className="panel"><div className="panel-head"><h2><Users size={17}/>Thành viên</h2><span className="tag gray">{members.items.length} đang hiển thị</span></div>
      {members.busy && !members.items.length ? <ShellState kind="loading" title="Đang tải thành viên" description="Đang kiểm tra quyền truy cập hiện tại."/> : members.error ? <div className="panel-body"><p className="form-error" role="alert">{members.error}</p><button className="btn" onClick={() => void members.reload()}>Thử lại</button></div> : !members.items.length ? <ShellState title="Chưa có thành viên để hiển thị" description="Danh sách phản ánh quyền hiện tại của nha khoa."/> : <div className="table-wrap"><table className="tenant-table data-table"><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{members.items.map(member => <tr key={member.userId}><td data-label="Thành viên"><strong>{member.name}{member.userId === data!.user.id ? " (bạn)" : ""}</strong><small>{member.email}</small></td><td data-label="Vai trò">Quản trị nha khoa</td><td data-label="Trạng thái"><span className={`tag ${member.status === "active" ? "green" : "gray"}`}>{member.status === "active" ? "Đang hoạt động" : "Đã thu hồi"}</span></td><td data-label="Thao tác"><button className="btn" disabled={!businessWrite || busy || member.status !== "active"} onClick={() => setAction({ kind: "member", member })}>Thu hồi</button></td></tr>)}</tbody></table></div>}
      {members.cursor && <div className="footer-row"><button className="btn" disabled={members.busy} onClick={() => void members.more()}>Tải thêm thành viên</button></div>}</section>
    <section className="panel"><div className="panel-head"><h2><MailPlus size={17}/>Mời quản trị viên</h2></div><div className="panel-body"><p>Quyền quản trị chỉ áp dụng cho nha khoa này. Người nhận phải xác minh email và chấp nhận lời mời. Lời mời có hiệu lực 24 giờ.</p><form onSubmit={invite} className="form-stack bounded-form"><label className="field">Email người nhận<input name="email" type="email" disabled={!businessWrite} required maxLength={254} autoComplete="email"/></label><label className="check-field"><input type="checkbox" required/>Cấp quyền quản trị nha khoa này cho đúng email trên.</label><button className="btn primary" disabled={!businessWrite || busy}>{busy ? "Đang xử lý…" : "Gửi lời mời"}</button></form></div>
      {invitations.busy && !invitations.items.length ? <ShellState kind="loading" title="Đang tải lời mời" description="Vui lòng chờ trong giây lát."/> : invitations.error ? <div className="panel-body"><p className="form-error" role="alert">{invitations.error}</p><button className="btn" onClick={() => void invitations.reload()}>Thử lại</button></div> : !invitations.items.length ? <ShellState title="Chưa có lời mời" description="Lời mời đã gửi sẽ xuất hiện tại đây."/> : <div className="table-wrap"><table className="tenant-table data-table"><thead><tr><th>Email</th><th>Trạng thái</th><th>Hiệu lực đến</th><th>Thao tác</th></tr></thead><tbody>{invitations.items.map(invitation => <tr key={invitation.id}><td data-label="Email">{invitation.email}</td><td data-label="Trạng thái">{invitation.acceptedAt ? "Đã chấp nhận" : invitation.revokedAt ? "Đã thu hồi" : "Chưa chấp nhận"}</td><td data-label="Hiệu lực đến">{new Date(invitation.expiresAt).toLocaleString("vi-VN")}</td><td data-label="Thao tác"><div className="buttons"><button className="btn" disabled={!businessWrite || busy || !!invitation.acceptedAt || !!invitation.revokedAt} onClick={() => setAction({ kind: "resend", invitation })}>Gửi lại</button><button className="btn" disabled={!businessWrite || busy || !!invitation.acceptedAt || !!invitation.revokedAt} onClick={() => setAction({ kind: "invitation", invitation })}>Thu hồi</button></div></td></tr>)}</tbody></table></div>}
      {invitations.cursor && <div className="footer-row"><button className="btn" disabled={invitations.busy} onClick={() => void invitations.more()}>Tải thêm lời mời</button></div>}</section>
    <section className="panel"><div className="panel-head"><h2><ShieldCheck size={17}/>Xác thực thao tác nhạy cảm</h2></div><div className="panel-body bounded-form"><ReauthForm/></div></section></div></>;
}
