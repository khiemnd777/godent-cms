import { ContentListing, listingMetadata } from "../../../components/content-route";
import { BuilderDetail, BuilderListRoute, builderDetailMetadata, builderListingMetadata } from "../../../components/builder-route";
import { builderKind } from "../../../lib/builder-routing";
import type { PublicSearchParams } from "../../../lib/public-content";
type Props = { params: Promise<{ tenant: string; section: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata(props: Props) { const { tenant, section } = await props.params, kind = builderKind(section); if (kind === "landing" || kind === "promotion") return builderListingMetadata(tenant, "vi", kind, await props.searchParams); if (kind) return listingMetadata(props); return builderDetailMetadata(tenant, "vi", "page", section); }
export default async function Route(props: Props) { const { tenant, section } = await props.params, kind = builderKind(section); if (kind === "landing" || kind === "promotion") return <BuilderListRoute tenant={tenant} locale="vi" kind={kind} searchParams={await props.searchParams}/>; if (kind) return <ContentListing {...props}/>; return <BuilderDetail tenant={tenant} locale="vi" kind="page" slug={section} searchParams={await props.searchParams}/>; }
