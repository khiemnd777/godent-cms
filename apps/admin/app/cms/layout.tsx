import { AdminShell } from "../../components/admin-shell";
import { SessionGate } from "../../components/session-provider";
import { WorkspaceGate } from "../../components/workspace";
import { PrivilegedGate } from "../../components/privileged-gate";
export default function CmsLayout({ children }: { children: React.ReactNode }) { return <SessionGate><AdminShell><WorkspaceGate><PrivilegedGate>{children}</PrivilegedGate></WorkspaceGate></AdminShell></SessionGate>; }
