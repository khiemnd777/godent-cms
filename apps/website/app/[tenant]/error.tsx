"use client";
import { usePathname } from "next/navigation";

export default function PublicContentError({ reset }: { reset: () => void }) {
  const en = /^\/(?:[^/]+\/)?en(?:\/|$)/.test(usePathname());
  return <main className="content-page"><h1>{en ? "Content temporarily unavailable" : "Chưa thể tải nội dung"}</h1><p>{en ? "Please reload this page to try again." : "Nội dung hiện chưa tải được. Vui lòng thử lại."}</p><button type="button" onClick={reset}>{en ? "Try again" : "Thử lại"}</button></main>;
}
