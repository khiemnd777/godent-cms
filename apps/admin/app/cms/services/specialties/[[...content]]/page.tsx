import { notFound } from "next/navigation";
import { contentRoute } from "../../../../../lib/content-navigation";
import { BuilderResourceList } from "../../../../../components/builder-pages";
import { BuilderResourceEntry } from "../../../../../components/builder-resource-entry";
import { ContentEditor } from "../../../../../components/content-editor";
import { ContentPreview } from "../../../../../components/content-preview";
export const metadata = { title: "Chuyên khoa" };
export default async function SpecialtyPage({ params }: { params: Promise<{ content?: string[] }> }) {
  const { content = [] } = await params; const route = contentRoute(`/cms/services/specialties${content.length ? `/${content.join("/")}` : ""}`); if (!route || route.section !== "specialty") notFound();
  return route.view === "list" ? <BuilderResourceList standalone kind="specialty"/> : route.view === "preview" ? <BuilderResourceEntry kind="specialty" id={route.id} preview><ContentPreview kind="specialty" id={route.id}/></BuilderResourceEntry> : route.id ? <BuilderResourceEntry kind="specialty" id={route.id}><ContentEditor key={route.id} kind="specialty" id={route.id}/></BuilderResourceEntry> : <ContentEditor kind="specialty"/>;
}
