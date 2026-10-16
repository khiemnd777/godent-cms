import { DraftEditor } from "../../../../components/draft-editor";
import { BuilderResourceEntry } from "../../../../components/builder-resource-entry";
export const metadata = { title: "Bản nháp dịch vụ" };
export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BuilderResourceEntry kind="service" id={id}><DraftEditor key={id} id={id}/></BuilderResourceEntry>; }
