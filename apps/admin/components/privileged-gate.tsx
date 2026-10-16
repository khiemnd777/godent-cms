"use client";
import Link from "next/link";
import { useSession } from "./session-provider";
import { ShellState } from "./shell-state";
export function PrivilegedGate({ children, platform = false }: { children: React.ReactNode; platform?: boolean }) {
  const { data } = useSession();
  if (!data) return <ShellState kind="denied" title="Đăng nhập để tiếp tục" description="Nội dung riêng chỉ hiển thị khi phiên đăng nhập còn hiệu lực."><Link className="btn primary" href="/login" prefetch={false}>Đăng nhập</Link></ShellState>;
  if (platform && !data?.platformAdmin) return <ShellState kind="denied" title="Không có quyền quản trị nền tảng" description="Tài khoản này không được cấp quyền quản trị nền tảng."/>;
  return <>{children}</>;
}
