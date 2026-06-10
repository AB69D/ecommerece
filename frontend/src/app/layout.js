import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import OrderChatbot from "@/components/OrderChatbot.jsx";
import PwaRegister from "@/components/PwaRegister.jsx";
import Analytics from "@/components/Analytics.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { CurrencyProvider } from "@/context/CurrencyContext.jsx";
import { fetchSiteSettings } from "@/lib/dynamicContent.js";
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
  const settings = await fetchSiteSettings();
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

export const viewport = {
  themeColor: "#0f766e",
};

export default async function RootLayout({ children }) {
  const settings = await fetchSiteSettings();
  const currencySymbol = settings?.currencySymbol || "$";
  const currencyCode = settings?.currencyCode || "USD";
  const pwaEnabled = settings?.features?.pwa !== false;
  const analyticsEnabled = settings?.features?.analytics !== false;
  const analytics = settings?.analytics || {};
  const siteJsonLd = buildSiteJsonLd(settings || {});
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Analytics
          enabled={analyticsEnabled}
          gtmId={analytics.gtmId}
          ga4Id={analytics.ga4Id}
          metaPixelId={analytics.metaPixelId}
        />
        {siteJsonLd.map((node, i) => (
          <JsonLd key={i} data={node} />
        ))}
        <CurrencyProvider initialSymbol={currencySymbol} initialCode={currencyCode}>
          <HeaderTop />
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
          <OrderChatbot />
          <PwaRegister enabled={pwaEnabled} />
        </CurrencyProvider>
      </body>
    </html>
  );
}
