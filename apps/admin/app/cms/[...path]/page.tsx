import { notFound } from "next/navigation";
import { cmsNavigation, findNavigation } from "../../../components/navigation";
import { ShellState } from "../../../components/shell-state";
import { contentRoute, contentSections } from "../../../lib/content-navigation";
import { ContentList } from "../../../components/content-list";
import { ContentEditor } from "../../../components/content-editor";
import { ContentPreview } from "../../../components/content-preview";
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; const route = contentRoute(`/cms/${path.join("/")}`); return { title: route ? contentSections[route.section].title : findNavigation(cmsNavigation, `/cms/${path.join("/")}`)?.label ?? "Trang không tồn tại" }; }
export default async function CmsSection({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; const route = contentRoute(`/cms/${path.join("/")}`); if (route) return route.view === "list" ? <ContentList kind={route.section}/> : route.view === "preview" ? <ContentPreview kind={route.section} id={route.id}/> : <ContentEditor key={`${route.section}:${route.id ?? "new"}`} kind={route.section} id={route.id}/>; const item = findNavigation(cmsNavigation, `/cms/${path.join("/")}`); if (!item) notFound(); return <><div className="page-head"><div><div className="eyebrow">Website nha khoa</div><h1>{item.label}</h1><p>Chưa kết nối website</p></div></div><section className="panel"><ShellState title={`${item.label} chưa khả dụng`} description="Khu vực này chưa kết nối dữ liệu. Bạn chưa thể xem hoặc thay đổi nội dung tại đây."/></section></>; }
