"use client";
import Link from "next/link";
import { ArrowRight, FileText, Globe, Smile } from "lucide-react";
import { useWorkspace } from "../../components/workspace";
export default function Overview() {
 const { membership, href } = useWorkspace();
 return <><div className="page-head"><div><div className="eyebrow">Website nha khoa</div><h1>Tổng quan</h1><p>Mọi điều bạn cần để chăm sóc website hôm nay.</p></div><Link className="btn primary" href={href("/cms/services/new")} prefetch={false}><FileText size={15}/>Soạn dịch vụ</Link></div>
 <section className="hero-panel"><div><div className="eyebrow">Không gian số cho nụ cười</div><h2>{membership?.tenantName}</h2><p>Soạn, xem trước và chủ động cập nhật dịch vụ lên website.</p><div className="site-link"><Globe size={14}/><span>Quản lý bản nháp và phiên bản đã xuất bản</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-window"><div className="art-top"><i/><i/><i/></div><div className="art-content"><div className="art-lines"><i/><i/><i/></div><div className="art-tooth"><Smile size={25}/></div></div></div></div></section>
 <section className="panel"><div className="panel-head"><h2>Nội dung website</h2><Link className="btn subtle" href={href("/cms/services")} prefetch={false}>Mở dịch vụ <ArrowRight size={13}/></Link></div><div className="panel-body"><p>Bản nháp chỉ hiển thị với quản trị viên đang có quyền truy cập nha khoa này. Lưu bản nháp chưa làm thay đổi website công khai.</p></div></section></>;
}
