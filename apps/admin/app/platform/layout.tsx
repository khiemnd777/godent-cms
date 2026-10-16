import { AdminShell } from "../../components/admin-shell";
import { SessionGate } from "../../components/session-provider";
import { PrivilegedGate } from "../../components/privileged-gate";
export default function PlatformLayout({ children }: { children: React.ReactNode }) { return <SessionGate><AdminShell area="platform"><PrivilegedGate platform>{children}</PrivilegedGate></AdminShell></SessionGate>; }
