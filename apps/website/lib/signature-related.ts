import type { M4Kind, PublicM4Page } from "../../api/src/contracts/m4";
import type { ReferenceKind } from "../../api/src/contracts/m3";
import type { BuilderListQuery } from "./public-builder";

/** Follow published relations with a bounded first page; never scan an entire catalog. */
export function signatureRelatedQueries(page: PublicM4Page): { kind: M4Kind; query: BuilderListQuery }[] {
  const kinds: M4Kind[] = page.kind === "service" ? ["price", "doctor", "case"] : page.kind === "specialty" ? ["service", "doctor"] : page.kind === "service_group" ? ["service"] : page.kind === "category" ? ["article"] : page.kind === "location" ? ["service", "doctor", "price"] : page.kind === "doctor" ? ["case"] : [];
  return kinds.flatMap(kind => {
    // Dentist profiles belong to specialties. A service does not imply a direct dentist assignment.
    const specialty = page.kind === "service" && kind === "doctor" ? page.references.find(reference => reference.kind === "specialty") : null;
    if (page.kind === "service" && kind === "doctor" && !specialty) return [];
    return [{ kind, query: { referenceKind: (specialty?.kind ?? page.kind) as ReferenceKind, referenceId: specialty?.id ?? page.id, referencePublicationId: specialty?.publicationId ?? page.publicationId, pageSize: 6 } }];
  });
}
