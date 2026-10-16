import { ContentListing, listingMetadata } from "../../../components/content-route";
import type { PublicSearchParams } from "../../../lib/public-content";
type Props = { params: Promise<{ tenant: string }>; searchParams: Promise<PublicSearchParams> };
const extend = (props: Props) => ({ ...props, params: props.params.then(params => ({ ...params, section: "dich-vu" })) });
export const generateMetadata = (props: Props) => listingMetadata(extend(props));
export default function ServiceListing(props: Props) { return <ContentListing {...extend(props)}/>; }
