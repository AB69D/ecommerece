import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import OrderChatbot from "@/components/OrderChatbot.jsx";
import PwaRegister from "@/components/PwaRegister.jsx";
import Analytics from "@/components/Analytics.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { CurrencyProvider } from "@/context/CurrencyContext.jsx";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext.jsx";
import { fetchSiteSettings } from "@/lib/dynamicContent.js";
import { SITE_URL, absoluteUrl, buildSiteJsonLd } from "@/lib/seo.js";

// ── Storefront chrome (per store) ────────────────────────────────────────────
// Wraps only the shopping surface of a store (not its admin/pos). Branding,
// theme, currency and SEO all come from THIS store's admin-editable settings,
// fetched with the store taken straight from the URL segment.

// Build this store's base metadata from its site settings.
export async function generateMetadata({ params }) {
  const { store } = await params;
  const settings = await fetchSiteSettings(store);
  const siteName = settings?.siteName || "Ab9dEcommerce";
  const seo = settings?.seo || {};
  const title = seo.defaultTitle || `${siteName} - Quality Products Online`;
  const description =
    seo.defaultDescription ||
    settings?.description ||
    settings?.tagline ||
    `${siteName} is promising to deliver products from our store to your door`;
  const ogImage = absoluteUrl(seo.ogImage || settings?.logoUrl || "/logo.png");
  const favicon = settings?.faviconUrl || settings?.logoUrl || "/icons/icon-192.png";
  const appleIcon = settings?.faviconUrl || settings?.logoUrl || "/icons/apple-touch-icon.png";
  const base = `/${store}`;

  return {
    metadataBase: new URL(SITE_URL),
    applicationName: siteName,
    title: { default: title, template: `%s | ${siteName}` },
    description,
    ...(seo.defaultKeywords ? { keywords: seo.defaultKeywords } : {}),
    alternates: { canonical: base },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: `${SITE_URL}${base}`,
      siteName,
      title,
      description,
      images: [{ url: ogImage, width: 800, height: 600, alt: siteName }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    robots: { index: true, follow: true },
    icons: { icon: favicon, apple: appleIcon },
  };
}

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

// Server-rendered theme variables (no flash of the wrong palette). The body wash
// is applied here too, since the root body is store-agnostic.
const themeCss = (t) => `:root{
--theme-nav-from:${t.navbarFrom};--theme-nav-via:${t.navbarVia};--theme-nav-to:${t.navbarTo};--theme-nav-text:${t.navbarText};
--theme-footer-from:${t.footerFrom};--theme-footer-via:${t.footerVia};--theme-footer-to:${t.footerTo};
--theme-home-from:${t.homeFrom};--theme-home-to:${t.homeTo};
--theme-primary:${t.primary};--theme-accent:${t.accent};
}
body{background-color:var(--theme-home-to);background-image:linear-gradient(180deg,var(--theme-home-from),var(--theme-home-to) 720px);background-repeat:no-repeat;}`;

export async function generateViewport({ params }) {
  const { store } = await params;
  const settings = await fetchSiteSettings(store);
  return { themeColor: settings?.theme?.navbarFrom || THEME_DEFAULTS.navbarFrom };
}

export default async function ShopLayout({ children, params }) {
  const { store } = await params;
  const settings = await fetchSiteSettings(store);
  const currencySymbol = settings?.currencySymbol || "$";
  const currencyCode = settings?.currencyCode || "USD";
  const pwaEnabled = settings?.features?.pwa !== false;
  const analyticsEnabled = settings?.features?.analytics !== false;
  const analytics = settings?.analytics || {};
  const siteJsonLd = buildSiteJsonLd(settings || {});
  const theme = resolveTheme(settings);

  return (
    <>
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
    </>
  );
}
