import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
export const metadata: Metadata = { title: "Godent", description: "Không gian website nha khoa Godent.", robots: { index: false, follow: false } };
export default async function RootLayout({ children }: { children: React.ReactNode }) { await connection(); return <html lang="vi"><body>{children}</body></html>; }
