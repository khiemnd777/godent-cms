import { notFound } from "next/navigation";
import { contentRoute } from "../../../../../lib/content-navigation";
import { BuilderResourceList } from "../../../../../components/builder-pages";
import { BuilderResourceEntry } from "../../../../../components/builder-resource-entry";
import { ContentEditor } from "../../../../../components/content-editor";
import { ContentPreview } from "../../../../../components/content-preview";
export const metadata = { title: "Nhóm dịch vụ" };
export default async function ServiceGroupPage({ params }: { params: Promise<{ content?: string[] }> }) {
  const { content = [] } = await params; const route = contentRoute(`/cms/services/groups${content.length ? `/${content.join("/")}` : ""}`); if (!route || route.section !== "service_group") notFound();
  return route.view === "list" ? <BuilderResourceList standalone kind="service_group"/> : route.view === "preview" ? <BuilderResourceEntry kind="service_group" id={route.id} preview><ContentPreview kind="service_group" id={route.id}/></BuilderResourceEntry> : route.id ? <BuilderResourceEntry kind="service_group" id={route.id}><ContentEditor key={route.id} kind="service_group" id={route.id}/></BuilderResourceEntry> : <ContentEditor kind="service_group"/>;
}
