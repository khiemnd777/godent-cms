"use client";
import { usePathname } from "next/navigation";
export default function PublicLoading() {
  const en = /^\/(?:[^/]+\/)?en(?:\/|$)/.test(usePathname());
  return <main className="content-page" aria-busy="true"><p role="status">{en ? "Loading clinic information…" : "Đang tải thông tin phòng khám…"}</p></main>;
}
