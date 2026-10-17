import type { ReactNode } from "react";
import { SignatureInquiryAction } from "./signature-inquiry-action";
export function SignaturePriceHeader({ title, image }: { title: string; image?: ReactNode }) {
  return <section className="signature-price-header">{image && <div className="signature-price-header-image" aria-hidden="true">{image}</div>}<div className="signature-container"><h1>{title}</h1></div></section>;
}
export function SignaturePriceIntroduction({ text, action, privatePreview }: { text: string; action?: { label: string; href: string } | null; privatePreview?: boolean }) {
  return text || action ? <section className="builder-prose signature-price-introduction">{text && <p>{text}</p>}{action && <SignatureInquiryAction className="signature-button" href={action.href} privatePreview={privatePreview}>{action.label}</SignatureInquiryAction>}</section> : null;
}
