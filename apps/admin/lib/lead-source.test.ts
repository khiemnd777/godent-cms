import { expect, test } from "bun:test";
import { leadSourceTitle, leadSourceKind } from "./lead-source";
test("legacy service and landing sources retain their own identity labels", () => {
  const legacy = { tenantSlug: "clinic", serviceTitle: "Service", serviceSlug: "service", publicationId: "pub", path: "/clinic/dich-vu/service" };
  expect(leadSourceTitle(legacy)).toBe("Service");
  expect(leadSourceKind(legacy)).toBe("Dịch vụ");
  const landing = { type: "landing" as const, tenantSlug: "clinic", resourceId: "landing-id", title: "Campaign page", slug: "campaign", publicationId: "pub", configPublicationId: null, path: "/clinic/landing/campaign", locale: "en" as const, promotion: null, tracking: {} };
  expect(leadSourceTitle(landing)).toBe("Campaign page");
  expect(leadSourceKind(landing)).toBe("Landing");
  expect(leadSourceTitle({ ...landing, type: "home", title: "Clinic homepage" })).toBe("Clinic homepage");
  expect(leadSourceKind({ ...landing, type: "home" })).toBe("Trang chủ");
  expect(leadSourceKind({ ...landing, type: "page" })).toBe("Trang nội dung");
});
