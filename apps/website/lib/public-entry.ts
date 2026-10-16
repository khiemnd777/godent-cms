import { exactObject, parseSlug } from "../../api/src/contracts/content";
import { m3Id } from "../../api/src/contracts/m3-validation";
import { M5_DOMAIN_ROUTES, type M5EntryContext } from "../../api/src/contracts/m5-domains";

function version(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError("Invalid entry version"); return Number(value); }
function origin(value: unknown): string {
  if (typeof value !== "string" || !/^http:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?:5892$/.test(value)) throw new TypeError("Invalid local public origin");
  const url = new URL(value); if (url.origin !== value || url.username || url.password) throw new TypeError("Invalid public origin"); return value;
}
export function parsePublicEntry(value: unknown, expectedHost?: string): M5EntryContext {
  const v = exactObject(value, ["tenantId", "siteId", "tenantSlug", "entry", "primary", "sitePagePath"]), tenantSlug = parseSlug(v.tenantSlug);
  const e = exactObject(v.entry, ["mode", "origin", "basePath", "bindingId", "generation"]), p = exactObject(v.primary, ["mode", "bindingId", "version", "origin", "basePath"]);
  if (!["platform", "custom"].includes(String(e.mode)) || !["godent", "custom"].includes(String(p.mode))) throw new TypeError("Invalid entry mode");
  const entryOrigin = origin(e.origin), primaryOrigin = origin(p.origin);
  if ((expectedHost && new URL(entryOrigin).host !== expectedHost) || e.basePath !== (e.mode === "platform" ? `/${tenantSlug}` : "") || p.basePath !== (p.mode === "godent" ? `/${tenantSlug}` : "") || (e.mode === "platform" && (entryOrigin !== "http://localhost:5892" || e.bindingId !== null || e.generation !== 0)) || (p.mode === "godent" && (primaryOrigin !== "http://localhost:5892" || p.bindingId !== null))) throw new TypeError("Invalid entry identity");
  if (typeof v.sitePagePath !== "string" || !v.sitePagePath.startsWith("/") || /[\\?#\s]/.test(v.sitePagePath) || v.sitePagePath.startsWith("//")) throw new TypeError("Invalid site route");
  return { tenantId: m3Id(v.tenantId), siteId: m3Id(v.siteId), tenantSlug, sitePagePath: v.sitePagePath, entry: { mode: e.mode as "platform" | "custom", origin: entryOrigin, basePath: String(e.basePath), bindingId: e.mode === "custom" ? m3Id(e.bindingId) : null, generation: version(e.generation) }, primary: { mode: p.mode as "godent" | "custom", origin: primaryOrigin, basePath: String(p.basePath), bindingId: p.mode === "custom" ? m3Id(p.bindingId) : null, version: version(p.version) } };
}
export function entryFromHeaders(headers: Pick<Headers, "get">, tenant: string): M5EntryContext {
  const raw = headers.get("x-gcms-entry"); if (!raw) throw new Error("Missing public entry context");
  const context = parsePublicEntry(JSON.parse(raw)); if (context.tenantSlug !== tenant) throw new Error("Public entry changed"); return context;
}
export function entryReadHeaders(context?: M5EntryContext): Record<string, string> {
  return context ? { "x-gcms-primary-version": String(context.primary.version), ...(context.entry.bindingId ? { "x-gcms-entry-binding": context.entry.bindingId, "x-gcms-entry-generation": String(context.entry.generation) } : {}) } : {};
}
export async function readPublicEntry(host: string, path: string): Promise<M5EntryContext | null> {
  const response = await fetch(`http://127.0.0.1:5890${M5_DOMAIN_ROUTES.entry(host, path)}`, { credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
  if ([404, 421].includes(response.status)) return null;
  if (!response.ok) throw new Error("Public entry is temporarily unavailable");
  const text = await response.text(); if (text.length > 8192) throw new Error("Invalid public entry"); return parsePublicEntry(JSON.parse(text), host);
}
