import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import OrderChatbot from "@/components/OrderChatbot.jsx";
import PwaRegister from "@/components/PwaRegister.jsx";
import Analytics from "@/components/Analytics.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import StoreBanner from "@/components/StoreBanner.jsx";
import { CurrencyProvider } from "@/context/CurrencyContext.jsx";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext.jsx";
import { fetchSiteSettings } from "@/lib/dynamicContent.js";
import { getActiveStore } from "@/lib/storeContext.js";
import { SITE_URL, absoluteUrl, buildSiteJsonLd } from "@/lib/seo.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Build the storefront's base metadata from the admin-editable site settings so
// the title, description, social cards and favicon all follow the panel.
export async function generateMetadata() {
  const settings = await fetchSiteSettings(await getActiveStore());
  const siteName = settings?.siteName || "Ab9dEcommerce";
  const seo = settings?.seo || {};
  const title = seo.defaultTitle || `${siteName} - Quality Products Online`;
  const description =
    seo.defaultDescription ||
    settings?.description ||
    settings?.tagline ||
    `${siteName} is promising to deliver products from our store to your door`;
  const ogImage = absoluteUrl(seo.ogImage || settings?.logoUrl || "/logo.png");
  // Browser-tab + iOS home-screen icons follow the admin logo: favicon first,
  // then the company logo, and only then the bundled placeholder.
  const favicon = settings?.faviconUrl || settings?.logoUrl || "/icons/icon-192.png";
  const appleIcon = settings?.faviconUrl || settings?.logoUrl || "/icons/apple-touch-icon.png";

  return {
    metadataBase: new URL(SITE_URL),
    applicationName: siteName,
    title: { default: title, template: `%s | ${siteName}` },
    description,
    ...(seo.defaultKeywords ? { keywords: seo.defaultKeywords } : {}),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: SITE_URL,
      siteName,
      title,
      description,
      images: [{ url: ogImage, width: 800, height: 600, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: favicon,
      apple: appleIcon,
    },
  };
}

// Brand-aligned theme defaults. The admin panel overrides any of these from the
// Appearance tab; everything missing falls back here so the storefront always
// has a complete, legible palette.
const THEME_DEFAULTS = {
  navbarFrom: "#065f46",
  navbarVia: "#047857",
  navbarTo: "#064e3b",
  navbarText: "#ecfdf5",
  footerFrom: "#064e3b",
  footerVia: "#065f46",
  footerTo: "#022c22",
  homeFrom: "#ecfdf5",
  homeTo: "#ffffff",
  primary: "#047857",
  accent: "#f59e0b",
};

const resolveTheme = (settings) => ({ ...THEME_DEFAULTS, ...(settings?.theme || {}) });

// Server-rendered CSS variables — no flash of the wrong colour on first paint.
// Navbar/Footer/home components read these via var(--theme-*). The body carries
// the soft home-background wash (top tint fading to the base colour); admin and
// POS paint their own opaque backgrounds on top, so they are unaffected.
const themeCss = (t) => `:root{
--theme-nav-from:${t.navbarFrom};--theme-nav-via:${t.navbarVia};--theme-nav-to:${t.navbarTo};--theme-nav-text:${t.navbarText};
--theme-footer-from:${t.footerFrom};--theme-footer-via:${t.footerVia};--theme-footer-to:${t.footerTo};
--theme-home-from:${t.homeFrom};--theme-home-to:${t.homeTo};
--theme-primary:${t.primary};--theme-accent:${t.accent};
}
body{background-color:var(--theme-home-to);background-image:linear-gradient(180deg,var(--theme-home-from),var(--theme-home-to) 720px);background-repeat:no-repeat;}`;

export async function generateViewport() {
  const settings = await fetchSiteSettings(await getActiveStore());
  // Match the mobile browser chrome to the top of the navbar gradient.
  return { themeColor: settings?.theme?.navbarFrom || THEME_DEFAULTS.navbarFrom };
}

export default async function RootLayout({ children }) {
  const settings = await fetchSiteSettings(await getActiveStore());
  const currencySymbol = settings?.currencySymbol || "$";
  const currencyCode = settings?.currencyCode || "USD";
  const pwaEnabled = settings?.features?.pwa !== false;
  const analyticsEnabled = settings?.features?.analytics !== false;
  const analytics = settings?.analytics || {};
  const siteJsonLd = buildSiteJsonLd(settings || {});
  const theme = resolveTheme(settings);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Server-rendered theme variables — first in the body so colours are set
            before any content paints (no flash of the default palette). */}
        <style id="theme-vars" dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        <Analytics
          enabled={analyticsEnabled}
          gtmId={analytics.gtmId}
          ga4Id={analytics.ga4Id}
          metaPixelId={analytics.metaPixelId}
        />
        {siteJsonLd.map((node, i) => (
          <JsonLd key={i} data={node} />
        ))}
        {/* Interim shared-domain notice: shows which store a guest is browsing
            (hidden on the primary store, admin and POS). */}
        <StoreBanner />
        <CurrencyProvider initialSymbol={currencySymbol} initialCode={currencyCode}>
          <CustomerAuthProvider>
            <HeaderTop />
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </main>
            <Footer />
            <OrderChatbot />
            <PwaRegister enabled={pwaEnabled} />
          </CustomerAuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
