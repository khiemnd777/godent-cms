import { notFound } from "next/navigation";
import { cmsNavigation, findNavigation } from "../../../components/navigation";
import { ShellState } from "../../../components/shell-state";
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; return { title: findNavigation(cmsNavigation, `/cms/${path.join("/")}`)?.label ?? "Trang không tồn tại" }; }
export default async function CmsSection({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; const item = findNavigation(cmsNavigation, `/cms/${path.join("/")}`); if (!item) notFound(); return <><div className="page-head"><div><div className="eyebrow">Website nha khoa</div><h1>{item.label}</h1><p>Chưa kết nối website</p></div></div><section className="panel"><ShellState title={`${item.label} chưa khả dụng`} description="Khu vực này chưa kết nối dữ liệu. Bạn chưa thể xem hoặc thay đổi nội dung tại đây."/></section></>; }
