import { DraftPreview } from "../../../../../components/draft-editor";
import { BuilderResourceEntry } from "../../../../../components/builder-resource-entry";
export const metadata = { title: "Xem trước riêng", robots: { index: false, follow: false } };
export default async function PreviewServicePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BuilderResourceEntry kind="service" id={id} preview><DraftPreview key={id} id={id}/></BuilderResourceEntry>; }
