"use client";
import { useState, type FormEvent } from "react";
import { apiRequest, errorText } from "../lib/access";
import { useSession } from "./session-provider";
export function ReauthForm({ onSuccess, purpose }: { onSuccess?: () => void; purpose?: string } = {}) {
  const { data } = useSession();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true); setError(""); setNotice("");
    try { await apiRequest("/api/session/reauth", { method: "POST", csrf: data!.csrfToken, body: { password: values.get("password") } }); form.reset(); setNotice("Đã xác thực lại. Bạn có thể thực hiện thao tác nhạy cảm trong 5 phút."); onSuccess?.(); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={submit}><p className="field-help">{purpose ?? "Xác thực lại để thay đổi quyền truy cập, quản lý nha khoa hoặc thay đổi bảo mật."} Hiệu lực 5 phút.</p><label className="field">Mật khẩu<input type="password" name="password" autoComplete="current-password" required maxLength={128}/></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}<button className="btn" disabled={busy || !data}>{busy ? "Đang xác thực…" : "Xác thực lại"}</button></form>;
}
