import { PlatformOperations } from "../../../components/platform-operations";
import { notFound } from "next/navigation";
import { platformNavigation, findNavigation } from "../../../components/navigation";
import { ShellState } from "../../../components/shell-state";
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; return { title: findNavigation(platformNavigation, `/platform/${path.join("/")}`)?.label ?? "Trang không tồn tại" }; }
export default async function PlatformSection({ params }: { params: Promise<{ path: string[] }> }) { const { path } = await params; if (path.join("/") === "limits") return <PlatformOperations/>; const item = findNavigation(platformNavigation, `/platform/${path.join("/")}`); if (!item) notFound(); return <><div className="page-head"><div><div className="eyebrow">Không gian nền tảng</div><h1>{item.label}</h1><p>Chưa kết nối dữ liệu nền tảng</p></div></div><section className="panel"><ShellState title={`${item.label} chưa khả dụng`} description="Khu vực này chưa kết nối dữ liệu. Bạn chưa thể xem hoặc thay đổi thông tin tại đây."/></section></>; }
