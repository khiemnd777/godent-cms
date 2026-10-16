import { RecoveryForm } from "../../components/recovery-form";
export const metadata = { title: "Quên mật khẩu" };
export default function ForgotPage() { return <main className="auth-page"><section className="auth-card"><RecoveryForm kind="request"/></section></main>; }
