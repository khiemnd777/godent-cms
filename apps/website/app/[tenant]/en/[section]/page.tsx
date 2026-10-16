import { BuilderDetail, BuilderListRoute, builderDetailMetadata, builderListingMetadata } from "../../../../components/builder-route";
import { builderKind } from "../../../../lib/builder-routing";
import type { PublicSearchParams } from "../../../../lib/public-content";
type Props = { params: Promise<{ tenant: string; section: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata({ params, searchParams }: Props) { const { tenant, section } = await params, kind = builderKind(section); return kind ? builderListingMetadata(tenant, "en", kind, await searchParams) : builderDetailMetadata(tenant, "en", "page", section); }
export default async function Route({ params, searchParams }: Props) { const { tenant, section } = await params, kind = builderKind(section); return kind ? <BuilderListRoute tenant={tenant} locale="en" kind={kind} searchParams={await searchParams}/> : <BuilderDetail tenant={tenant} locale="en" kind="page" slug={section} searchParams={await searchParams}/>; }
