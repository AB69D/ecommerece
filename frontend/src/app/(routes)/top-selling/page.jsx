import TopSelling from "@/components/TopSelling";

export const metadata = {
    title: "Top Selling Products | Ab9dEcommerce - Best Sellers",
    description: "Check out our top selling products at Ab9dEcommerce. Discover the most popular a wide range of products loved by our customers.",
    keywords: "top selling products, best sellers Ab9dEcommerce, popular products, best products, top rated products",
    openGraph: {
        title: "Top Selling Products | Ab9dEcommerce",
        description: "Check out our top selling products at Ab9dEcommerce.",
        url: "https://example.com/top-selling",
        siteName: "Ab9dEcommerce",
        images: [
            {
                url: "/logo.png",
                width: 800,
                height: 600,
                alt: "Ab9dEcommerce Logo"
            }
        ],
        type: "website"
    },
    twitter: {
        card: "summary_large_image",
        title: "Top Selling Products | Ab9dEcommerce",
        description: "Check out our top selling products at Ab9dEcommerce.",
        images: ["/logo.png"]
    }
};

export default function TopSellingPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <TopSelling />
                </div>
            </div>
        </div>
    );
}
