import { RecoveryForm } from "../../components/recovery-form";
export const metadata = { title: "Xác minh email" };
export default function VerifyPage() { return <main className="auth-page"><section className="auth-card"><RecoveryForm kind="verify"/></section></main>; }
