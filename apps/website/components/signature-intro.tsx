import type { ReactNode } from "react";
export function SignatureIntro({ id, brand, title, text, image, action, mainHeading = false }: { id: string; brand: string; title: string; text: string; image?: ReactNode; action?: { label: string; href: string; locale: "vi" | "en" } | null; mainHeading?: boolean }) {
  const Heading = mainHeading ? "h1" : "h2";
  return <section className={`builder-hero signature-intro${image ? " has-image" : ""}`} aria-labelledby={`section-${id}`}><div className="builder-hero-copy"><p className="eyebrow">{brand}</p><Heading id={`section-${id}`}>{title}</Heading>{text && <p className="builder-intro">{text}</p>}{action && <a className="builder-action" href={action.href} lang={action.locale}>{action.label}</a>}</div>{image && <div className="signature-intro-media">{image}</div>}</section>;
}
