import { notFound } from "next/navigation";
import { contentRoute } from "../../../../../lib/content-navigation";
import { ContentList } from "../../../../../components/content-list";
import { ContentEditor } from "../../../../../components/content-editor";
import { ContentPreview } from "../../../../../components/content-preview";
export const metadata = { title: "Chuyên khoa" };
export default async function SpecialtyPage({ params }: { params: Promise<{ content?: string[] }> }) {
  const { content = [] } = await params; const route = contentRoute(`/cms/services/specialties${content.length ? `/${content.join("/")}` : ""}`); if (!route || route.section !== "specialty") notFound();
  return route.view === "list" ? <ContentList kind="specialty"/> : route.view === "preview" ? <ContentPreview kind="specialty" id={route.id}/> : <ContentEditor key={route.id ?? "new"} kind="specialty" id={route.id}/>;
}
