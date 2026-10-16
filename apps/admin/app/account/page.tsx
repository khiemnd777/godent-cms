import { AccountSecurity } from "../../components/account-security";
import { SessionGate } from "../../components/session-provider";
export const metadata = { title: "Tài khoản và bảo mật" };
export default function AccountPage() { return <SessionGate><AccountSecurity/></SessionGate>; }
