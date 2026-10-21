import { expect, test } from "bun:test";
import type { M4Variant } from "../../api/src/contracts/m4";
import { builderRoute, builderPublishCommand, emptyBuilder, moveSection, prepareBuilderSave, builderSaveFailure, builderSources, compileBuilderInput, builderInputDirty } from "./builder-state";
import { permissionScopes, permissionKey, promotionState, instantForInput, inputForInstant, newSection, sectionKinds, setCarouselSlideHighlight } from "./builder-content";
import { parseBuilderContent } from "../../api/src/contracts/m4-validation";

const id = "135f1fb4-b121-4628-842c-4bc6bcd82932";
test("builder routes keep home identity separate from ordinary page identity", () => {
  expect(builderRoute("/cms/pages")).toEqual({ view: "list" });
  expect(builderRoute("/cms/pages/home/new")).toEqual({ view: "editor", kind: "home" });
  expect(builderRoute(`/cms/pages/${id}/preview`)).toEqual({ view: "preview", kind: "page", id });
  expect(builderRoute(`/cms/pages/home/${id}`)).toEqual({ view: "editor", kind: "home", id });
  for (const path of ["/cms/pages/prototype", `/cms/pages/${id}/delete`, `/cms/pages/home/${id}/preview/extra`]) expect(builderRoute(path)).toBeNull();
});
test("keyboard section moves retain every section and do not mutate the saved baseline", () => {
  const content = emptyBuilder("home");
  const original = structuredClone(content.sections);
  const moved = moveSection(content.sections, 0, 1);
  expect(moved.map(section => section.id)).toEqual([original[1].id, original[0].id]);
  expect(content.sections).toEqual(original);
  expect(moveSection(content.sections, 0, -1)).toEqual(original);
  expect(moveSection(content.sections, 1, 1)).toEqual(original);
});
test("an uncertain save retries the same captured content and operation", () => {
  const content = emptyBuilder("page"); content.title = "Saved title"; content.slug = "my-page";
  const captured = prepareBuilderSave(null, content, 4, () => id);
  content.title = "Later typing";
  expect("title" in captured.content && captured.content.title).toBe("Saved title");
  expect(prepareBuilderSave(captured, content, 9)).toBe(captured);
  expect(builderSaveFailure(undefined, undefined, false, true)).toEqual({ unknown: true, retain: true, conflict: false, denied: false });
  expect(builderSaveFailure(409, undefined, false, true)).toEqual({ unknown: false, retain: false, conflict: true, denied: false });
  expect(builderSaveFailure(403, undefined, false, true).denied).toBe(true);
  expect(builderSaveFailure(403, "REAUTH_REQUIRED", true, true).denied).toBe(false);
});
test("home carousel highlight follows its slide into the saved draft and clears without stale data", () => {
  const content = emptyBuilder("home");
  const carousel = newSection("hero_carousel"); if (carousel.type !== "hero_carousel") throw Error();
  carousel.slides[0].title = "Care begins with listening";
  content.sections = [setCarouselSlideHighlight(carousel, 0, "listening")];
  const captured = prepareBuilderSave(null, content, 2, () => id);
  const saved = captured.content; if (!("sections" in saved) || saved.sections[0].type !== "hero_carousel") throw Error();
  expect(saved.sections[0].slides[0].highlight).toBe("listening");
  content.sections = [setCarouselSlideHighlight(saved.sections[0], 0, "")];
  expect("highlight" in (content.sections[0] as typeof carousel).slides[0]).toBe(false);
  expect(saved.sections[0].slides[0].highlight).toBe("listening");
});
test("publish confirmation binds the saved revision and active config publication", () => {
  const draft = { version: 4, publicationVersion: 2, publicationRevision: 3 } as M4Variant;
  expect(builderPublishCommand(draft, id, "operation")).toEqual({ operationId: "operation", expectedVersion: 4, expectedPublicationVersion: 2, expectedPublicationRevision: 3, expectedConfigPublicationId: id });
  expect(builderPublishCommand(draft, null, "operation").expectedConfigPublicationId).toBeNull();
});
test("rich text authoring remains separate from saved nodes until save", () => {
  const saved = emptyBuilder("home"); saved.title = "Home";
  const source = { ...builderSources(saved), intro: "## New heading\nText entered locally" };
  expect(builderInputDirty(saved, saved, source)).toBe(true);
  const compiled = compileBuilderInput(saved, source);
  expect("sections" in compiled && compiled.sections[1].type === "rich_text" && compiled.sections[1].body.blocks[0].type).toBe("heading");
  expect(builderSources(saved).intro).toBe("");
  expect(builderInputDirty(saved, saved, builderSources(saved))).toBe(false);
});
test("invalid rich text keeps the entered source and cannot become a saved draft", () => {
  const content = emptyBuilder("home"); const sources = { intro: "[unsafe](javascript:alert)" };
  expect(() => compileBuilderInput(content, sources)).toThrow();
  expect(sources.intro).toBe("[unsafe](javascript:alert)");
  expect(builderInputDirty(content, content, sources)).toBe(true);
});
test("removed section source cannot keep a successfully saved draft dirty", () => {
  const before = emptyBuilder("home"); const after = { ...before, sections: [before.sections[0]] };
  expect(builderInputDirty(after, after, { intro: "text from removed section" })).toBe(false);
});
test("M4 locale routes bind the same resource identity and reject unsupported locales", () => {
  expect(builderRoute(`/cms/variants/service/${id}/en`)).toEqual({ view: "editor", kind: "service", id, locale: "en" });
  expect(builderRoute(`/cms/variants/doctor/${id}/vi/preview`)).toEqual({ view: "preview", kind: "doctor", id, locale: "vi" });
  expect(builderRoute(`/cms/variants/service/${id}/fr`)).toBeNull();
});
test("permission scopes use the current saved material usage and keep patient text explicit", () => {
  const content = emptyBuilder("home"); const hero = content.sections[0]; if (hero.type !== "hero") throw Error();
  hero.image = { assetId: id, revision: 3, alt: "Photo" };
  expect(permissionScopes("home", content)).toEqual([{ label: "Ảnh Hero · Photo", scope: { type: "asset", assetId: id, assetRevision: 3, usage: "hero" } }]);
  expect(permissionScopes("case", { kind: "case", image: null } as never)[0].scope).toEqual({ type: "text" });
  expect(permissionKey({ type: "asset", assetId: id, assetRevision: 3, usage: "logo" })).not.toBe(permissionKey({ type: "asset", assetId: id, assetRevision: 3, usage: "hero" }));
});
test("promotion validity uses a closed start and open end with explicit UTC authoring", () => {
  expect(promotionState("2026-10-16T00:00:00.000Z", "2026-10-17T00:00:00.000Z", Date.parse("2026-10-15T23:59:59.999Z"))).toBe("upcoming");
  expect(promotionState("2026-10-16T00:00:00.000Z", "2026-10-17T00:00:00.000Z", Date.parse("2026-10-16T00:00:00.000Z"))).toBe("active");
  expect(promotionState("2026-10-16T00:00:00.000Z", "2026-10-17T00:00:00.000Z", Date.parse("2026-10-17T00:00:00.000Z"))).toBe("expired");
  expect(instantForInput("2026-10-16T07:30")).toBe("2026-10-16T07:30:00.000Z");
  expect(inputForInstant("2026-10-16T07:30:00.000Z")).toBe("2026-10-16T07:30");
  expect(instantForInput("2026-02-30T12:00")).toBe("");
});
test("promotion wall times respect the authored timezone and reject ambiguous DST", () => {
  expect(instantForInput("2026-10-16T07:30", "Asia/Ho_Chi_Minh")).toBe("2026-10-16T00:30:00.000Z");
  expect(inputForInstant("2026-10-16T00:30:00.000Z", "Asia/Ho_Chi_Minh")).toBe("2026-10-16T07:30");
  expect(instantForInput("2026-03-08T02:30", "America/New_York")).toBe("");
  expect(instantForInput("2026-11-01T01:30", "America/New_York")).toBe("");
  expect(instantForInput("2026-04-05T01:45", "Australia/Lord_Howe")).toBe("");
});
test("every supported reference section uses the canonical builder schema", () => {
  const page = emptyBuilder("page"); page.title = "Page"; page.slug = "new-page";
  page.sections = Object.keys(sectionKinds).map(type => newSection(type as keyof typeof sectionKinds));
  expect(parseBuilderContent(page).sections.map(section => section.type)).toEqual(Object.keys(sectionKinds) as (keyof typeof sectionKinds)[]);
  page.sections.push(newSection("consultation"));
  expect(parseBuilderContent(page).sections.at(-1)?.type).toBe("consultation");
  expect(parseBuilderContent({ ...page, kind: "landing" }).sections.at(-1)?.type).toBe("consultation");
  page.sections.push(newSection("consultation"));
  expect(() => parseBuilderContent(page)).toThrow();
});
test("carousel authoring keeps every saved slide image in its hero permission scope", () => {
  const page = emptyBuilder("home");
  page.sections = [{ id: "campaign", type: "hero_carousel", hidden: false, autoplay: false, intervalMs: 7000, slides: [{ id: "one", title: "First", text: "", action: null, image: { assetId: id, revision: 2, alt: "First image" } }, { id: "two", title: "Second", text: "", action: null, image: { assetId: id, revision: 3, alt: "Second image" } }] }];
  const scopes = permissionScopes("home", page);
  expect(scopes.map(item => item.scope)).toEqual([{ type: "asset", usage: "hero", assetId: id, assetRevision: 2 }, { type: "asset", usage: "hero", assetId: id, assetRevision: 3 }]);
});
test("save captures the observed legacy state and never changes it during retry", () => {
  const state = { version: 3, publicationVersion: 2, publicationRevision: 4, pointer: id, generation: 8 };
  const saved = prepareBuilderSave(null, emptyBuilder("home"), 3, () => id, state);
  state.version = 9;
  expect(saved.expectedLegacyState?.version).toBe(3);
  expect(prepareBuilderSave(saved, emptyBuilder("home"), 9, () => "other", state)).toBe(saved);
});

test("does not require version comparison for an explicit quota denial", () => {
  const result = builderSaveFailure(409, "QUOTA_EXCEEDED", false, true);
  expect(result.conflict).toBe(false); expect(result.unknown).toBe(false); expect(result.retain).toBe(false); expect(result.denied).toBe(false);
});
