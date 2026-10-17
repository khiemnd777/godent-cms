import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { SessionProvider } from "../components/session-provider";
import "./globals.css";
import "../../website/app/signature.css";
export const metadata: Metadata = { title: { default: "Godent", template: "%s · Godent" }, robots: { index: false, follow: false } };
// useSearchParams needs a boundary during static rendering: https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Keep administration documents request-bound, including token-entry forms.
  // https://nextjs.org/docs/app/api-reference/functions/connection
  await connection();
  return <html lang="vi"><body><Suspense fallback={<p className="standalone" role="status">Đang tải…</p>}><SessionProvider>{children}</SessionProvider></Suspense></body></html>;
}
