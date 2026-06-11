import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo.js";

// ── Root layout (platform shell) ─────────────────────────────────────────────
// Path-based multi-tenancy: the storefront, admin and POS all live under a
// /<store> segment (app/[store]/…), each with its own layout and chrome. This
// root is therefore deliberately MINIMAL — just <html>/<body>, fonts and global
// CSS — so the non-store pages (the platform-owner login at /, the global store
// login at /login, the /platform dashboard, /sell) render clean, and each store
// supplies its own branding/theme inside [store].

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ab9d — Multi-store commerce platform",
  description: "Launch and run your own online store and point-of-sale.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
