import { RecoveryForm } from "../../components/recovery-form";
export const metadata = { title: "Đặt lại mật khẩu" };
export default function ResetPage() { return <main className="auth-page"><section className="auth-card"><RecoveryForm kind="reset"/></section></main>; }
