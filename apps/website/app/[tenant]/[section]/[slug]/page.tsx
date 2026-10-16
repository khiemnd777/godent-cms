import { notFound } from "next/navigation";
import { ContentDetail, detailMetadata } from "../../../../components/content-route";
import { BuilderDetail, builderDetailMetadata } from "../../../../components/builder-route";
import { builderKind } from "../../../../lib/builder-routing";
import type { PublicSearchParams } from "../../../../lib/public-content";
type Props = { params: Promise<{ tenant: string; section: string; slug: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata(props: Props) { const { tenant, section, slug } = await props.params, kind = builderKind(section); if (!kind) notFound(); return kind === "landing" || kind === "promotion" ? builderDetailMetadata(tenant, "vi", kind, slug) : detailMetadata(props); }
export default async function Route(props: Props) { const { tenant, section, slug } = await props.params, kind = builderKind(section); if (!kind) notFound(); return kind === "landing" || kind === "promotion" ? <BuilderDetail tenant={tenant} locale="vi" kind={kind} slug={slug} searchParams={await props.searchParams}/> : <ContentDetail {...props}/>; }
