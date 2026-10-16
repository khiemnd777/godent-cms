import { headers as requestHeaders } from "next/headers";
import { entryFromHeaders } from "../../../lib/public-entry";
import { readPublicBuilderSeo } from "../../../lib/public-builder";
const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  try { const { tenant } = await params, entries = await readPublicBuilderSeo(tenant, entryFromHeaders(await requestHeaders(), tenant)); if (!entries) return new Response("Not found", { status: 404, headers });
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(entry => `<url><loc>${escapeXml(entry.canonicalUrl)}</loc>${entry.alternates.map(alternate => `<xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${escapeXml(alternate.url)}"/>`).join("")}</url>`).join("")}</urlset>`, { headers });
  } catch { return new Response("Content temporarily unavailable", { status: 503, headers }); }
}
