import type { ReactNode } from "react";
/** The service's current CMS title, summary and projected image supply its banner. */
export function SignatureServiceBanner({ title, text, image }: { title: string; text: string; image?: ReactNode }) {
  return <section className={`signature-service-banner signature-slide${image ? " has-image" : ""}`} aria-labelledby="service-banner-title">{image && <div className="signature-slide-image">{image}</div>}<div className="signature-container signature-slide-inner"><div className="signature-slide-copy"><h1 id="service-banner-title">{title}</h1>{text && <p>{text}</p>}</div></div></section>;
}
