import { notFound } from "next/navigation";
import { BuilderDetail, builderDetailMetadata } from "../../../../../components/builder-route";
import { builderKind } from "../../../../../lib/builder-routing";
import type { PublicSearchParams } from "../../../../../lib/public-content";
type Props = { params: Promise<{ tenant: string; section: string; slug: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata({ params }: Props) { const { tenant, section, slug } = await params, kind = builderKind(section); if (!kind) notFound(); return builderDetailMetadata(tenant, "en", kind, slug); }
export default async function Route({ params, searchParams }: Props) { const { tenant, section, slug } = await params, kind = builderKind(section); if (!kind) notFound(); return <BuilderDetail tenant={tenant} locale="en" kind={kind} slug={slug} searchParams={await searchParams}/>; }
