import type { M4Locale } from "../../api/src/contracts/m4";
export function SignatureUnavailableConsultation({ locale, title }: { locale: M4Locale; title?: string }) {
  return <section className="consultation consultation-compact consultation-unavailable" role="status"><h2>{title || (locale === "en" ? "Consultation requests" : "Yêu cầu tư vấn")}</h2><p>{locale === "en" ? "This page is not accepting new consultation requests." : "Trang hiện không nhận yêu cầu tư vấn mới."}</p></section>;
}
