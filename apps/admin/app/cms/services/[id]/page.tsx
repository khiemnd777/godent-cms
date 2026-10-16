import { DraftEditor } from "../../../../components/draft-editor";
export const metadata = { title: "Bản nháp dịch vụ" };
export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DraftEditor key={id} id={id}/>; }
