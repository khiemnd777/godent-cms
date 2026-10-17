import type { ReactNode } from "react";
export function SignatureInquiryAction({ href, privatePreview, className, children }: { href?: string; privatePreview?: boolean; className?: string; children: ReactNode }) {
  return privatePreview ? <button type="button" className={className} disabled aria-disabled="true">{children}</button> : href ? <a className={className} href={href}>{children}</a> : null;
}
