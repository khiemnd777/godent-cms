"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tenantContext, tenantHref } from "../lib/access";
import { useSession } from "./session-provider";
import { TenantCapabilities } from "./tenant-capabilities";
import { ShellState } from "./shell-state";
export function useWorkspace() {
  const { data } = useSession();
  const search = useSearchParams();
  const id = search.get("tenant");
  const membership = tenantContext(id, data?.tenantMemberships ?? []);
  return { membership, requestedTenant: id, href: (path: string) => tenantHref(path, membership?.tenantId ?? null) };
}
export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const { membership, requestedTenant } = useWorkspace();
  if (!membership) return <ShellState kind={requestedTenant ? "denied" : "empty"} title={requestedTenant ? "Không có quyền truy cập nha khoa này" : "Chọn nha khoa"} description="Chỉ các nha khoa bạn đang có quyền quản trị mới xuất hiện ở đây."><div className="workspace-options">{data?.tenantMemberships.map(member => <Link className="btn" key={member.tenantId} href={tenantHref("/cms", member.tenantId)} prefetch={false}>{member.tenantName}</Link>)}</div>{!data?.tenantMemberships.length && <p>Tài khoản chưa có quyền quản trị nha khoa.</p>}</ShellState>;
  return <div key={membership.tenantId}><TenantCapabilities tenantId={membership.tenantId}>{children}</TenantCapabilities></div>;
}
