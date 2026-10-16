"use client";
import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import type { M5Capabilities, M5PlatformStatus } from "../../api/src/contracts/m5-platform";
import { m5Route } from "../lib/m5-input";
import { tenantHref } from "../lib/access";
import { usePrivateRecord } from "./use-private-record";
import { ShellState } from "./shell-state";

const denied: M5Capabilities = { read: false, export: false, businessWrite: false, safetyWrite: false };
const Context = createContext<M5Capabilities>(denied);
export const useTenantCapabilities = () => useContext(Context);
export function TenantCapabilities({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const record = usePrivateRecord<M5PlatformStatus>(m5Route("tenant", tenantId));
  if (record.loading && !record.value) return <ShellState kind="loading" title="Đang kiểm tra trạng thái nha khoa" description="Đang kiểm tra quyền đọc và thao tác hiện tại."/>;
  if (!record.value) return <ShellState kind="error" title="Chưa thể kiểm tra trạng thái nha khoa" description={record.error}><button className="btn" onClick={() => void record.reload()}>Thử lại</button></ShellState>;
  const status = record.value;
  if (!status.capabilities.read) return <ShellState kind="denied" title="Nha khoa không còn cho phép truy cập dữ liệu" description="Nha khoa đang thực hiện hoặc đã hoàn tất xóa dữ liệu. Liên hệ quản trị nền tảng để kiểm tra trạng thái."/>;
  return <Context.Provider value={status.capabilities}>{!status.capabilities.businessWrite && <div className="notice" role="status"><strong>Nha khoa đang tạm dừng.</strong><p>Bạn có thể đọc, xuất dữ liệu, ngừng xuất bản và thu hồi quyền công bố. Các thay đổi nghiệp vụ khác đang bị chặn.</p><Link className="btn" href={tenantHref("/cms/settings/data", tenantId)} prefetch={false}>Trạng thái và xuất dữ liệu</Link></div>}{children}</Context.Provider>;
}
