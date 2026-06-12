import Showcase from "@/components/Showcase.jsx";
import NewArrivals from "@/components/New-Arraivals.jsx";
import AllProducts from "@/components/AllProducts.jsx";
import TopSelling from "@/components/TopSelling.jsx";
import CustomerReviews from "@/components/CustomerReviews.jsx";
import { fetchSiteSettings } from "@/lib/dynamicContent.js";
import { SITE_URL, absoluteUrl } from "@/lib/seo.js";

// Home metadata follows THIS store's settings. We omit `title` so the store's
// layout title template ("<store name> - …") applies — otherwise every store's
// home would share one hardcoded title.
export async function generateMetadata({ params }) {
    const { store } = await params;
    const s = await fetchSiteSettings(store);
    const siteName = s?.siteName || "Ab9dEcommerce";
    const description =
        s?.seo?.defaultDescription || s?.description || s?.tagline ||
        `Shop quality products at ${siteName}.`;
    const ogImage = absoluteUrl(s?.seo?.ogImage || s?.logoUrl || "/logo.png");
    return {
        description,
        ...(s?.seo?.defaultKeywords ? { keywords: s.seo.defaultKeywords } : {}),
        openGraph: {
            title: siteName,
            description,
            url: `${SITE_URL}/${store}`,
            siteName,
            images: [{ url: ogImage, width: 800, height: 600, alt: siteName }],
            type: "website",
        },
        twitter: { card: "summary_large_image", title: siteName, description, images: [ogImage] },
    };
}

export default function Home() {
  return (
    <div>
      <Showcase />
      <NewArrivals />
      <TopSelling />
      <AllProducts />
      <CustomerReviews />
    </div>
  );
}
