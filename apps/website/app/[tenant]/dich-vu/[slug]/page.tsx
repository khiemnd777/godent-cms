import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readPublicService } from "../../../../lib/public-service";
import { RichText } from "../../../../components/rich-text";
import { ConsultationForm } from "../../../../components/consultation-form";
const loadPage = cache(readPublicService);
type Props = { params: Promise<{ tenant: string; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, slug } = await params; const page = await loadPage(tenant, slug);
  if (!page) return { title: "Không tìm thấy trang", robots: { index: false, follow: false } };
  return { title: page.service.seo.title || `${page.service.title} | ${page.site.name}`, description: page.service.seo.description || page.service.summary, alternates: { canonical: page.canonicalUrl }, robots: { index: false, follow: false } };
}
export default async function ServicePage({ params }: Props) {
  const { tenant, slug } = await params; const page = await loadPage(tenant, slug); if (!page) notFound();
  return <><a className="skip" href="#main-content">Đến nội dung chính</a><header><span className="site-name">{page.site.name}</span></header><main id="main-content" className="service-page"><article><p className="eyebrow">Dịch vụ</p><h1>{page.service.title}</h1>{page.service.summary && <p className="service-summary">{page.service.summary}</p>}{page.coverMedia &&
    // The eligibility gateway must handle each image request; no framework image cache may bypass revocation.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="service-cover" src={`http://127.0.0.1:5890${page.coverMedia.path}`} alt={page.coverMedia.alt} width={page.coverMedia.width} height={page.coverMedia.height}/>}
    <RichText document={page.service.body}/></article><ConsultationForm tenantSlug={tenant} serviceSlug={slug} publicationId={page.publicationId}/></main><footer className="site-footer">{page.site.footer.intro && <p>{page.site.footer.intro}</p>}<RichText document={page.site.footer.body}/></footer></>;
}
