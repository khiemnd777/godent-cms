"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, errorText, tenantHref } from "../lib/access";
import { useSession } from "./session-provider";
import { LoginForm } from "./login-form";
import { ReauthForm } from "./reauth-form";
import { INVITATION_NAME_LIMIT, invitationNameError } from "../lib/invitation-input";

export function InvitationOnboarding() {
  const session = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<string | null>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("token") ?? new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
    url.searchParams.delete("token"); url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    void Promise.resolve().then(() => setToken(value));
    return () => mutation.current?.abort();
  }, []);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setError("");
    const name = String(values.get("name") ?? "");
    const invalidName = invitationNameError(name); if (invalidName) { setError(invalidName); return; }
    if (values.get("password") !== values.get("confirm")) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    const controller = new AbortController(); mutation.current = controller; setBusy(true);
    try {
      await apiRequest("/api/auth/invitation-register", { method: "POST", body: { token, name: name.trim(), password: values.get("password") }, signal: controller.signal });
      if (controller.signal.aborted) return;
      form.reset(); setRegistered(true); setRegistering(false);
    } catch (error) { if (!controller.signal.aborted) setError(errorText(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const controller = new AbortController(); mutation.current = controller; setBusy(true); setError("");
    try {
      const result = await apiRequest<{ tenantId: string }>("/api/invitations/accept", { method: "POST", csrf: session.data!.csrfToken, body: { token }, signal: controller.signal });
      if (controller.signal.aborted) return;
      setToken(""); setAccepted(result.tenantId); await session.refresh();
    } catch (error) { if (!controller.signal.aborted) setError(`${errorText(error)} Kiểm tra đúng tài khoản được mời, xác thực lại hoặc yêu cầu người mời gửi liên kết mới.`); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card invitation-card"><div className="eyebrow">Lời mời Godent</div><h1>Tham gia quản trị nha khoa</h1><p>Lời mời gắn với một email, một nha khoa và quyền quản trị nha khoa. Chỉ tiếp tục nếu bạn là người nhận được mời.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {accepted ? <><p className="notice" role="status">Đã chấp nhận lời mời. Quyền quản trị đã được cập nhật.</p><Link className="btn primary" href={tenantHref("/cms", accepted)} prefetch={false}>Mở nha khoa</Link></> : token === null ? <p role="status">Đang kiểm tra liên kết…</p> : !token ? <p className="form-error" role="alert">Không có liên kết mời hợp lệ. Mở lại liên kết từ email hoặc yêu cầu người mời gửi lại.</p> : <>
      <p className="field-help">Giữ tab này mở trong khi xác minh email. Nếu tải lại trang, hãy mở lại liên kết mời trong email.</p>
      {registered && <p className="notice" role="status">Đã tạo tài khoản chưa xác minh. Mở email xác minh trong tab mới, rồi đăng nhập bên dưới. Tài khoản chưa có quyền quản trị cho đến khi chấp nhận lời mời.</p>}
      {session.status === "loading" ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : !session.data ? registering ? <form className="form-stack" onSubmit={register}><h2>Tạo tài khoản theo lời mời</h2><p className="field-help">Email của tài khoản được xác định từ lời mời. Mật khẩu cần từ 12 đến 128 ký tự.</p><label className="field">Họ tên<input name="name" required maxLength={INVITATION_NAME_LIMIT} autoComplete="name"/></label><label className="field">Mật khẩu mới<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><label className="field">Nhập lại mật khẩu mới<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><button className="btn primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo tài khoản"}</button><button type="button" className="inline-link" onClick={() => setRegistering(false)}>Đã có tài khoản? Đăng nhập</button></form> : <div className="onboarding-step"><LoginForm onAuthenticated={() => setError("")}/>{!registered && <button className="inline-link" onClick={() => setRegistering(true)}>Chưa có tài khoản? Tạo từ lời mời</button>}</div> : <div className="form-stack"><p>Đang đăng nhập: <strong>{session.data.user.email}</strong></p>{!session.data.user.emailVerified ? <><p>Xác minh email trước khi chấp nhận lời mời.</p><Link href="/verify-email" target="_blank" rel="noopener noreferrer" prefetch={false}>Gửi lại email xác minh trong tab mới</Link></> : <><ReauthForm/><form className="form-stack" onSubmit={accept}><label className="check-field"><input type="checkbox" required/>Tôi xác nhận nhận quyền quản trị theo lời mời gửi cho email của mình.</label><button className="btn primary" disabled={busy}>{busy ? "Đang kiểm tra…" : "Chấp nhận lời mời"}</button></form></>}<button className="btn" onClick={() => void session.refresh()} disabled={busy}>Kiểm tra lại phiên</button><button className="inline-link" onClick={() => void session.logout().catch(error => setError(errorText(error)))}>Đăng xuất để dùng tài khoản khác</button></div>}
    </>}<div className="auth-links"><Link href="/login" prefetch={false}>Trở về đăng nhập</Link></div></section></main>;
}
