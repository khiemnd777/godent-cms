import { BuilderDetail, builderDetailMetadata } from "../../components/builder-route";
import type { PublicSearchParams } from "../../lib/public-content";
type Props = { params: Promise<{ tenant: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata({ params }: Props) { const { tenant } = await params; return builderDetailMetadata(tenant, "vi", "home", "home"); }
export default async function Home({ params, searchParams }: Props) { const { tenant } = await params; return <BuilderDetail tenant={tenant} locale="vi" kind="home" slug="home" searchParams={await searchParams}/>; }
