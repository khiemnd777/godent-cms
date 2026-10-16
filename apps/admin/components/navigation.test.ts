import { expect, it } from "bun:test";
import { cmsNavigation, findActiveNavigation, findNavigation } from "./navigation";
it("keeps service detail and preview navigation active without accepting unknown placeholder routes", () => {
  expect(findActiveNavigation(cmsNavigation, "/cms/services/a/preview")?.label).toBe("Dịch vụ");
  expect(findActiveNavigation(cmsNavigation, "/cms/services/new")?.label).toBe("Dịch vụ");
  expect(findNavigation(cmsNavigation, "/cms/services/a/unknown")).toBeUndefined();
});
it("keeps locale variant editors in their business navigation group", () => {
  const id = "135f1fb4-b121-4628-842c-4bc6bcd82932";
  expect(findActiveNavigation(cmsNavigation, `/cms/variants/service/${id}/en`)?.label).toBe("Dịch vụ");
  expect(findActiveNavigation(cmsNavigation, `/cms/variants/doctor/${id}/en/preview`)?.label).toBe("Bác sĩ");
  expect(findActiveNavigation(cmsNavigation, `/cms/variants/landing/${id}/en`)?.label).toBe("Khuyến mãi & Landing");
  expect(findActiveNavigation(cmsNavigation, `/cms/variants/page/${id}/en`)?.label).toBe("Trang");
});
