"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, ArrowLeft, LogOut, Clock3, UserRound } from "lucide-react";
import { errorText } from "../lib/access";
import { useSession } from "./session-provider";
import { ReauthForm } from "./reauth-form";

export function AccountSecurity() {
  const { data, logout } = useSession();
  const [error, setError] = useState("");
  return <main className="account-page"><Link className="back-link" href={data!.platformAdmin ? "/platform" : "/cms"} prefetch={false}><ArrowLeft size={14}/>Không gian quản trị</Link><div className="page-head"><div><div className="eyebrow">Tài khoản Godent</div><h1>Tài khoản và bảo mật</h1><p>{data!.user.name} · {data!.user.email}</p></div><button className="btn" onClick={() => void logout().catch(error => setError(errorText(error)))}><LogOut size={15}/>Đăng xuất</button></div>
    {error && <p className="notice error form-error" role="alert">{error}</p>}
    <div className="account-grid">
      <section className="panel"><div className="panel-head"><h2>Thông tin tài khoản</h2><UserRound size={18}/></div><div className="panel-body form-stack"><p>{data!.user.emailVerified ? "Email đã được xác minh." : "Email chưa được xác minh."}</p><p className="field-help">Đăng nhập bằng email và mật khẩu của tài khoản. Liên kết đặt lại mật khẩu được gửi qua email.</p><Link className="btn" href="/forgot-password" prefetch={false}>Đặt lại mật khẩu</Link></div></section>
      <section className="panel"><div className="panel-head"><h2>Phiên đăng nhập</h2><Clock3 size={18}/></div><div className="panel-body form-stack"><p>Hết hạn lúc <time dateTime={data!.session.expiresAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(data!.session.expiresAt))}</time>.</p><p className="field-help">Phiên đăng nhập có thời hạn tối đa 8 giờ. Đăng xuất kết thúc quyền truy cập của phiên này.</p></div></section>
      <section className="panel"><div className="panel-head"><h2>Xác thực lại tài khoản</h2><ShieldCheck size={18}/></div><div className="panel-body"><ReauthForm/></div></section>
    </div></main>;
}
