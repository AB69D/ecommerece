import ProductClient from "./ProductClient";
import JsonLd from "@/components/JsonLd.jsx";
import { SITE_URL, absoluteUrl } from "@/lib/seo.js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Shared per-request fetch. generateMetadata() and the page component both call
// this; Next dedupes identical GET fetches within a render so the network only
// sees one request each.
async function getSettings() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/site-settings`, { next: { revalidate: 60 } });
        const json = await res.json();
        return json?.data || {};
    } catch {
        return {};
    }
}

async function getProduct(id) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/product/product/${id}`, { next: { revalidate: 60 } });
        const json = await res.json();
        return json?.success ? json.data : null;
    } catch {
        return null;
    }
}

async function getRatingSummary(id) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/review/product/${id}`, { next: { revalidate: 60 } });
        const json = await res.json();
        return json?.success ? json.data : null;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }) {
    const { id } = await params;
    const [settings, product] = await Promise.all([getSettings(), getProduct(id)]);
    const siteName = settings?.siteName || "Ab9dEcommerce";
    const currencySymbol = settings?.currencySymbol || "$";

    if (product) {
        const productName = `${product.firstName} ${product.lastName || ''}`.trim();
        const description = product.description || `${productName} - Available at ${siteName}`;
        const image = absoluteUrl(product.cover_image || product.weights?.[0]?.images?.[0] || "/logo.png");
        const price = product.weights?.[0]?.price || 0;

        return {
            // Root layout adds the " | <siteName>" suffix via its title template.
            title: `${productName} - ${currencySymbol}${price}`,
            description,
            keywords: [product.firstName, product.lastName, product.category?.category_name, siteName, 'products']
                .filter(Boolean)
                .join(', '),
            alternates: { canonical: `/product/${id}` },
            openGraph: {
                title: productName,
                description,
                url: `${SITE_URL}/product/${id}`,
                images: [{ url: image, width: 800, height: 600, alt: productName }],
                type: 'website',
                siteName,
            },
            twitter: {
                card: 'summary_large_image',
                title: productName,
                description,
                images: [image],
            },
        };
    }

    return {
        title: 'Product Details',
        description: `View product details at ${siteName}`,
    };
}

export default async function ProductDetailsPage({ params }) {
    const { id } = await params;
    const [settings, product, summary] = await Promise.all([
        getSettings(),
        getProduct(id),
        getRatingSummary(id),
    ]);

    let productLd = null;
    if (product) {
        const productName = `${product.firstName} ${product.lastName || ''}`.trim();
        const image = absoluteUrl(product.cover_image || product.weights?.[0]?.images?.[0] || "/logo.png");
        const price = product.weights?.[0]?.price || 0;
        const currencyCode = settings?.currencyCode || "USD";
        const inStock = (product.weights || []).some((w) => Number(w?.stock) > 0);

        productLd = {
            "@context": "https://schema.org",
            "@type": "Product",
            name: productName,
            description: product.description || productName,
            image: [image],
            ...(product.category?.category_name ? { category: product.category.category_name } : {}),
            offers: {
                "@type": "Offer",
                url: `${SITE_URL}/product/${id}`,
                price: String(price),
                priceCurrency: currencyCode,
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
            ...(summary?.count > 0
                ? {
                      aggregateRating: {
                          "@type": "AggregateRating",
                          ratingValue: String(summary.average),
                          reviewCount: String(summary.count),
                      },
                  }
                : {}),
        };
    }

    return (
        <>
            {productLd && <JsonLd data={productLd} />}
            <ProductClient productId={id} />
        </>
    );
}
