"use client";
import Link from "next/link";
import { contentSections, type ContentSection } from "../lib/content-navigation";
import { useWorkspace } from "./workspace";

export function ContentTabs({ section }: { section: ContentSection | "service" }) {
  const { href } = useWorkspace();
  const family = section === "service" ? "services" : contentSections[section].family;
  if (family !== "services" && family !== "articles") return null;
  const items = family === "services" ? [{ title: "Dịch vụ", path: "/cms/services", selected: section === "service" }, ...(["specialty", "service_group"] as const).map(key => ({ ...contentSections[key], selected: section === key }))] : (["article", "category", "faq"] as const).map(key => ({ ...contentSections[key], selected: section === key }));
  return <nav className="content-section-tabs" aria-label={family === "services" ? "Dịch vụ và danh mục" : "Bài viết và câu hỏi"}>{items.map(item => <Link key={item.path} className={`tab${item.selected ? " selected" : ""}`} href={href(item.path)} prefetch={false} aria-current={item.selected ? "page" : undefined}>{item.title}</Link>)}</nav>;
}
