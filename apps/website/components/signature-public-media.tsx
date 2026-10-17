import type { ContentPublicMedia } from "../../api/src/contracts/m3";
import type { M4Kind, M4Locale } from "../../api/src/contracts/m4";
import { SignatureGallery, SignatureLightboxImage } from "./signature-gallery";
export function SignaturePublicMedia({ kind, media, locale }: { kind: M4Kind; media: ContentPublicMedia[]; locale: M4Locale }) { if (kind === "gallery") return <SignatureGallery media={media} locale={locale}/>; const image = media.find(item => item.slot === "image" || item.slot === "cover"); return image ? <SignatureLightboxImage image={image.media} caption={image.caption} locale={locale}/> : null; }
