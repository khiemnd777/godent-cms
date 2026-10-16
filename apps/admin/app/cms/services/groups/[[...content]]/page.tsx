import { notFound } from "next/navigation";
import { contentRoute } from "../../../../../lib/content-navigation";
import { ContentList } from "../../../../../components/content-list";
import { ContentEditor } from "../../../../../components/content-editor";
import { ContentPreview } from "../../../../../components/content-preview";
export const metadata = { title: "Nhóm dịch vụ" };
export default async function ServiceGroupPage({ params }: { params: Promise<{ content?: string[] }> }) {
  const { content = [] } = await params; const route = contentRoute(`/cms/services/groups${content.length ? `/${content.join("/")}` : ""}`); if (!route || route.section !== "service_group") notFound();
  return route.view === "list" ? <ContentList kind="service_group"/> : route.view === "preview" ? <ContentPreview kind="service_group" id={route.id}/> : <ContentEditor key={route.id ?? "new"} kind="service_group" id={route.id}/>;
}
