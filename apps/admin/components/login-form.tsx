"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, errorText } from "../lib/access";
import { useSession } from "./session-provider";

export function LoginForm({ onAuthenticated }: { onAuthenticated?: () => void } = {}) {
  const router = useRouter();
  const Heading = onAuthenticated ? "h2" : "h1";
  const { refresh, clear } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError("");
    try {
      clear();
      await apiRequest("/api/auth/sign-in/email", { method: "POST", body: { email: values.get("email"), password: values.get("password"), rememberMe: false } });
      form.reset();
      const current = await refresh();
      if (!current) throw new Error("Session unavailable");
      if (onAuthenticated) onAuthenticated(); else router.replace(current.platformAdmin ? "/platform" : "/cms");
    } catch (error) { setError(`${error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403) ? "Email hoặc mật khẩu chưa hợp lệ, hoặc email chưa được xác minh." : errorText(error)} Nếu chưa xác minh email, hãy kiểm tra hộp thư hoặc gửi lại email xác minh.`); }
    finally { setBusy(false); }
  }
  return <><div className="eyebrow">Godent Admin</div><Heading>Đăng nhập</Heading><p>Truy cập không gian quản trị nha khoa của bạn.</p><form className="form-stack" onSubmit={submit}>
    <label className="field">Email<input name="email" type="email" autoComplete="username" maxLength={254} required/></label><label className="field">Mật khẩu<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{busy ? "Đang kiểm tra…" : "Đăng nhập"}</button>
  </form><div className="auth-links"><Link href="/forgot-password" prefetch={false}>Quên mật khẩu?</Link><Link href="/verify-email" prefetch={false}>Gửi lại email xác minh</Link></div></>;
}
