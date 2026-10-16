import { expect, it } from "bun:test";
import { cmsNavigation, findActiveNavigation, findNavigation } from "./navigation";
it("keeps service detail and preview navigation active without accepting unknown placeholder routes", () => {
  expect(findActiveNavigation(cmsNavigation, "/cms/services/a/preview")?.label).toBe("Dịch vụ");
  expect(findActiveNavigation(cmsNavigation, "/cms/services/new")?.label).toBe("Dịch vụ");
  expect(findNavigation(cmsNavigation, "/cms/services/a/unknown")).toBeUndefined();
});
