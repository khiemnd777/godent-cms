"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ADMIN_ORIGIN, apiRequest, errorText } from "../lib/access";
import { useSession } from "./session-provider";
export function RecoveryForm({ kind }: { kind: "request" | "reset" | "verify" }) {
  const search = useSearchParams();
  const [token] = useState(() => search.get("token") ?? "");
  const { clear } = useSession();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // Remove bearer links from the address bar after capturing them in this view's memory.
  useEffect(() => { if (kind === "reset" && token) window.history.replaceState(null, "", "/reset-password"); }, [kind, token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true); setError("");
    if (kind === "reset" && values.get("password") !== values.get("confirm")) { setError("Mật khẩu xác nhận chưa khớp."); setBusy(false); return; }
    try {
      if (kind === "reset") { await apiRequest("/api/auth/reset-password", { method: "POST", body: { token, newPassword: values.get("password") } }); clear(); }
      else if (kind === "verify") await apiRequest("/api/auth/send-verification-email", { method: "POST", body: { email: values.get("email"), callbackURL: `${ADMIN_ORIGIN}/login` } });
      else await apiRequest("/api/auth/request-password-reset", { method: "POST", body: { email: values.get("email"), redirectTo: `${ADMIN_ORIGIN}/reset-password` } });
      form.reset(); setDone(true);
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <><div className="eyebrow">Tài khoản Godent</div><h1>{kind === "request" ? "Quên mật khẩu" : kind === "reset" ? "Đặt lại mật khẩu" : "Xác minh email"}</h1><p>{kind === "reset" ? "Đặt mật khẩu mới từ 12 đến 128 ký tự. Các phiên đăng nhập hiện có sẽ kết thúc." : "Nhập email để nhận hướng dẫn nếu tài khoản đáp ứng điều kiện."}</p>{done ? <p className="notice auth-notice" role="status">{kind === "reset" ? "Đã đặt lại mật khẩu và kết thúc các phiên đăng nhập. Đăng nhập lại bằng mật khẩu mới." : "Nếu tài khoản đáp ứng điều kiện, hướng dẫn đã được gửi đến email. Vui lòng kiểm tra hộp thư."}</p> : <form onSubmit={submit} className="form-stack">{kind === "reset" ? <><label className="field">Mật khẩu mới<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><label className="field">Nhập lại mật khẩu mới<input name="confirm" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>{!token && <p className="form-error" role="alert">Liên kết đặt lại mật khẩu không hợp lệ. Yêu cầu một liên kết mới.</p>}</> : <label className="field">Email<input name="email" type="email" maxLength={254} autoComplete="email" required/></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy || (kind === "reset" && !token)}>{busy ? "Đang gửi…" : kind === "reset" ? "Lưu mật khẩu mới" : "Gửi hướng dẫn"}</button></form>}<div className="auth-links"><Link href="/login" prefetch={false}>Trở về đăng nhập</Link>{kind === "reset" && <Link href="/forgot-password" prefetch={false}>Yêu cầu liên kết mới</Link>}</div></>;
}
