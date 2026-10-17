import { M4_KINDS, type M4Kind } from "../../api/src/contracts/m4";
import { InvalidBuilderQuery } from "./builder-routing";
import type { PublicSearchParams } from "./public-content";

export type PublicSearchQuery = { q: string; kind?: M4Kind; cursor?: string };
export function parsePublicSearchQuery(params: PublicSearchParams): PublicSearchQuery {
  const { q, kind, cursor } = params;
  if ([q, kind, cursor].some(Array.isArray) || typeof q !== "string" && q !== undefined || typeof q === "string" && (q.length > 160 || /[\u0000-\u001f\u007f]/.test(q)) || kind !== undefined && kind !== "" && !(M4_KINDS as readonly unknown[]).includes(kind) || cursor !== undefined && (typeof cursor !== "string" || cursor.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(cursor))) throw new InvalidBuilderQuery();
  const text = (q ?? "").normalize("NFC").trim();
  return { q: text, ...(kind ? { kind: kind as M4Kind } : {}), ...(cursor ? { cursor: cursor as string } : {}) };
}
export function publicSearchQueryString(query: PublicSearchQuery): string { const params = new URLSearchParams(); if (query.q) params.set("q", query.q); if (query.kind) params.set("kind", query.kind); if (query.cursor) params.set("cursor", query.cursor); return params.size ? `?${params}` : ""; }
