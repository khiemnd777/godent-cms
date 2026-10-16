import { DraftPreview } from "../../../../../components/draft-editor";
export const metadata = { title: "Xem trước riêng", robots: { index: false, follow: false } };
export default async function PreviewServicePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DraftPreview key={id} id={id}/>; }
