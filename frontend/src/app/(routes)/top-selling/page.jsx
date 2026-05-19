import TopSelling from "@/components/TopSelling";

export const metadata = {
    title: "Top Selling Products | Gram2Ghor - Best Sellers",
    description: "Check out our top selling organic products at Gram2Ghor. Discover the most popular ghee, honey, mustard oil, dates, and traditional Bengali food products loved by our customers.",
    keywords: "top selling products, best sellers Gram2Ghor, popular organic products, best ghee, best honey, top rated food products Bangladesh",
    openGraph: {
        title: "Top Selling Products | Gram2Ghor",
        description: "Check out our top selling organic products at Gram2Ghor.",
        url: "https://gram2ghor.com/top-selling",
        siteName: "Gram2Ghor",
        images: [
            {
                url: "/logo.png",
                width: 800,
                height: 600,
                alt: "Gram2Ghor Logo"
            }
        ],
        type: "website"
    },
    twitter: {
        card: "summary_large_image",
        title: "Top Selling Products | Gram2Ghor",
        description: "Check out our top selling organic products at Gram2Ghor.",
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
