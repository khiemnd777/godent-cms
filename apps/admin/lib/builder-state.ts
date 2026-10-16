import { M4_KINDS, type BuilderContent, type BuilderSection, type LegacySourceState, type M4Content, type M4Kind, type M4Locale, type M4PublishInput, type M4Variant } from "../../api/src/contracts/m4";
import { documentSource, sourceDocument } from "./rich-text";
import { versionedFailure } from "./versioned-operation";
import { inputForInstant, instantForInput } from "./builder-content";

export type BuilderKind = "home" | "page" | "landing";
export type BuilderRoute = { view: "list"; family?: "campaigns" } | { view: "editor"; kind: M4Kind; id?: string; locale?: M4Locale } | { view: "preview"; kind: M4Kind; id: string; locale?: M4Locale };
export function builderRoute(path: string): BuilderRoute | null {
  if (path === "/cms/pages") return { view: "list" };
  if (path === "/cms/promotions" || path === "/cms/landings") return { view: "list", family: "campaigns" };
  const variant = /^\/cms\/variants\/([a-z_]+)\/([0-9a-f-]{36})\/(vi|en)(\/preview)?$/.exec(path);
  if (variant && (M4_KINDS as readonly string[]).includes(variant[1]) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(variant[2])) return { view: variant[4] ? "preview" : "editor", kind: variant[1] as M4Kind, id: variant[2], locale: variant[3] as M4Locale };
  const campaign = /^\/cms\/(promotions|landings)\/(new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/preview)?$/i.exec(path);
  if (campaign && !(campaign[2] === "new" && campaign[3])) return campaign[2] === "new" ? { view: "editor", kind: campaign[1] === "promotions" ? "promotion" : "landing" } : { view: campaign[3] ? "preview" : "editor", kind: campaign[1] === "promotions" ? "promotion" : "landing", id: campaign[2] };
  const match = /^\/cms\/pages\/(home\/)?(new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/preview)?$/i.exec(path);
  if (!match || match[2] === "new" && match[3]) return null;
  const kind = match[1] ? "home" : "page";
  return match[2] === "new" ? { view: "editor", kind } : match[3] ? { view: "preview", kind, id: match[2] } : { view: "editor", kind, id: match[2] };
}
export function builderEditorPath(kind: M4Kind, id?: string, locale: M4Locale = "vi") {
  if (id && (locale === "en" || !["home", "page", "landing", "promotion"].includes(kind))) return `/cms/variants/${kind}/${id}/${locale}`;
  if (kind === "promotion" || kind === "landing") return `/cms/${kind === "promotion" ? "promotions" : "landings"}/${id ?? "new"}`;
  return `/cms/pages/${kind === "home" ? "home/" : ""}${id ?? "new"}`;
}
export function emptyBuilder(kind: BuilderKind): BuilderContent {
  return { kind, slug: kind === "home" ? "home" : "", title: "", summary: "", seo: { title: "", description: "" }, sections: [
    { id: "hero", type: "hero", hidden: false, title: "", text: "", image: null, action: null },
    { id: "intro", type: "rich_text", hidden: false, body: sourceDocument("") },
  ] };
}
export function moveSection(sections: BuilderSection[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= sections.length || target < 0 || target >= sections.length) return sections;
  const next = [...sections]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export type BuilderSave = { operationId: string; expectedVersion?: number; content: M4Content; expectedLegacyState?: LegacySourceState | null };
export function prepareBuilderSave(pending: BuilderSave | null, content: M4Content, version?: number, createId = () => crypto.randomUUID(), legacyState?: LegacySourceState | null): BuilderSave {
  return pending ?? { operationId: createId(), ...(version !== undefined ? { expectedVersion: version } : {}), content: structuredClone(content), ...(legacyState !== undefined ? { expectedLegacyState: structuredClone(legacyState) } : {}) };
}
export function builderPublishCommand(draft: M4Variant, configPublicationId: string | null, operationId: string): M4PublishInput {
  return { operationId, expectedVersion: draft.version, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedConfigPublicationId: configPublicationId };
}
export function builderSaveFailure(status: number | undefined, code: string | undefined, previouslyUnknown: boolean, existing: boolean) {
  return { ...versionedFailure(status, code, previouslyUnknown), conflict: existing && status === 409, denied: [401, 403, 404].includes(status ?? 0) && code !== "REAUTH_REQUIRED" };
}
export function builderSources(content: M4Content): Record<string, string> {
  if ("name" in content) return { footer: documentSource(content.footer.body) };
  if ("sections" in content) return Object.fromEntries(content.sections.flatMap(section => section.type === "rich_text" ? [[section.id, documentSource(section.body)]] : []));
  return { body: documentSource(content.body), ...("kind" in content && content.kind === "promotion" ? { startAt: inputForInstant(content.startAt, content.authoredTimezone), endAt: inputForInstant(content.endAt, content.authoredTimezone) } : {}) };
}
export function compileBuilderInput(content: M4Content, sources: Record<string, string>): M4Content {
  const body = (key: string, saved: Parameters<typeof documentSource>[0], limit?: number) => sources[key] === undefined || sources[key] === documentSource(saved) ? saved : sourceDocument(sources[key], limit);
  if ("name" in content) return { ...content, footer: { ...content.footer, body: body("footer", content.footer.body, 2000) } };
  if ("sections" in content) return { ...content, sections: content.sections.map(section => section.type === "rich_text" ? { ...section, body: body(section.id, section.body) } : section) };
  return { ...content, body: body("body", content.body), ...("kind" in content && content.kind === "promotion" ? { startAt: sources.startAt === undefined || sources.startAt === inputForInstant(content.startAt, content.authoredTimezone) ? content.startAt : instantForInput(sources.startAt, content.authoredTimezone), endAt: sources.endAt === undefined || sources.endAt === inputForInstant(content.endAt, content.authoredTimezone) ? content.endAt : instantForInput(sources.endAt, content.authoredTimezone) } : {}) };
}
export function builderInputDirty(content: M4Content, baseline: M4Content | null, sources: Record<string, string>) {
  if (JSON.stringify(content) !== JSON.stringify(baseline)) return true;
  return Object.entries(builderSources(content)).some(([key, saved]) => sources[key] !== undefined && sources[key] !== saved);
}
