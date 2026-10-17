import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import "./globals.css";
import "./signature.css";
export const metadata: Metadata = { title: "Godent", description: "Không gian website nha khoa Godent.", robots: { index: false, follow: false } };
// Proxy overwrites the locale header after validating the public path and handling EN fallback.
// https://nextjs.org/docs/app/api-reference/functions/headers
export default async function RootLayout({ children }: { children: React.ReactNode }) { await connection(); const locale = (await headers()).get("x-gcms-locale") === "en" ? "en" : "vi"; return <html lang={locale}><body>{children}</body></html>; }
