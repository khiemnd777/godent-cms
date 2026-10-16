import { expect, test } from "bun:test";
import { contentRoute } from "./content-navigation";
const id = "135f1fb4-b121-4628-842c-4bc6bcd82932";
test("resolves nested taxonomy and article sections before the parent section", () => {
  expect(contentRoute("/cms/services/specialties")).toEqual({ section: "specialty", view: "list" });
  expect(contentRoute("/cms/articles/categories/new")).toEqual({ section: "category", view: "editor" });
  expect(contentRoute(`/cms/articles/faq/${id}/preview`)).toEqual({ section: "faq", view: "preview", id });
  expect(contentRoute(`/cms/articles/${id}`)).toEqual({ section: "article", view: "editor", id });
});
test("rejects unknown paths and extra lifecycle segments", () => {
  for (const path of ["/cms/unknown", "/cms/articles/not-a-resource", `/cms/articles/${id}/delete`, `/cms/locations/${id}/preview/other`]) expect(contentRoute(path)).toBeNull();
});
