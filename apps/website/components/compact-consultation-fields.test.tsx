import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { M4_CONSENTS } from "../../api/src/contracts/m4";
import { CompactConsultationFields, emptyCompactConsultation } from "./compact-consultation-fields";
test("compact consultation preserves visible consent and all optional contact controls with inert preview support", () => {
  for (const locale of ["vi", "en"] as const) {
    const html = renderToStaticMarkup(<CompactConsultationFields locale={locale} formId="request" values={emptyCompactConsultation(locale)} disabled consent={M4_CONSENTS[locale].copy} services={[{ publicationId: "service-pub", slug: "implant", title: "Implant" }]} locations={[{ publicationId: "location-pub", id: "location", title: "Clinic" }]} onChange={() => {}}/>);
    expect(html).toContain("<fieldset disabled"); expect(html).toContain('type="tel"'); expect(html).toContain('type="email"'); expect(html).toContain("Implant"); expect(html).toContain("Clinic"); expect(html).toContain(M4_CONSENTS[locale].copy); expect(html.indexOf('class="consultation-consent"')).toBeGreaterThan(html.indexOf("</details>")); expect(html).not.toContain("<form");
  }
});
