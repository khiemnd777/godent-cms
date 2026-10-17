import { expect, test } from "bun:test";
import { emptyContent } from "../../admin/lib/content-input";
import { localMediaUrl } from "./local-media-url";
import { distinctSignatureSummary, withoutRepeatedIntro } from "./signature-presentation";
import { signatureRelatedQueries } from "./signature-related";
import { createHomePage, ids, testDoc } from "../test-support/builder";
import type { M4PublicReference, PublicM4Page } from "../../api/src/contracts/m4";

test("identical doctor titles and testimonial quotations are not repeated as summaries", () => {
  const doctor = emptyContent("doctor"); if (doctor.kind !== "doctor") throw Error();
  doctor.professionalTitle = "Gentle care"; doctor.summary = "  Gentle   care "; expect(distinctSignatureSummary(doctor)).toBe("");
  doctor.summary = "A different introduction"; expect(distinctSignatureSummary(doctor)).toBe("A different introduction");
  const quote = emptyContent("testimonial"); if (quote.kind !== "testimonial") throw Error(); quote.quote = "A clear conversation"; quote.summary = quote.quote;
  expect(distinctSignatureSummary(quote)).toBe("");
  const document = { ...testDoc, blocks: [...testDoc.blocks, ...testDoc.blocks] };
  expect(withoutRepeatedIntro(document, "Published clinic information").blocks).toHaveLength(1); expect(document.blocks).toHaveLength(2); expect(withoutRepeatedIntro(document, "Different summary")).toBe(document);
});
test("related queries follow explicit published specialties and keep a fixed bounded page", () => {
  const page: PublicM4Page = { ...createHomePage(), kind: "service" };
  expect(signatureRelatedQueries(page).map(item => item.kind)).toEqual(["price", "case"]);
  const specialty = { id: ids.asset, kind: "specialty", publicationId: ids.config } as M4PublicReference;
  page.references = [specialty]; const queries = signatureRelatedQueries(page);
  expect(queries.find(item => item.kind === "doctor")?.query).toEqual({ referenceKind: "specialty", referenceId: ids.asset, referencePublicationId: ids.config, pageSize: 6 });
  expect(queries.every(item => item.query.pageSize === 6)).toBe(true); expect(queries).toHaveLength(3);
  expect(signatureRelatedQueries({ ...page, kind: "category" }).map(item => item.kind)).toEqual(["article"]);
  expect(signatureRelatedQueries({ ...page, kind: "page" })).toEqual([]);
});
test("image access stays on the loopback API and never forwards a private capability to another origin", () => {
  expect(localMediaUrl("/api/media/access/current?signature=bounded")).toBe("http://127.0.0.1:5890/api/media/access/current?signature=bounded");
  expect(localMediaUrl("/api/public/builder-media/image#ignored")).not.toContain("#");
  for (const path of ["https://external.invalid/api/image?signature=private", "//external.invalid/api/image", "javascript:alert(1)", "/private/image", "http://localhost:5890/api/image", "/api/unsafe\\path"]) expect(() => localMediaUrl(path)).toThrow();
});
