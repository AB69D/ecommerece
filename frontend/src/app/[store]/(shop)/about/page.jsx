import { fetchPage } from "@/lib/dynamicContent";
import CmsArticle from "@/components/CmsArticle";

export const metadata = {
    title: "About Ab9dEcommerce | Quality Products",
    description: "Learn about Ab9dEcommerce - Your trusted source for our authentic products. We provide pure various products, pickles, and traditional food items directly from local farmers.",
    keywords: "about Ab9dEcommerce, products, our authentic products, local farmers, sustainable agriculture, traditional food",
    openGraph: {
        title: "About Ab9dEcommerce",
        description: "Learn about Ab9dEcommerce - Your trusted source for our authentic products.",
        url: "https://example.com/about",
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
        title: "About Ab9dEcommerce",
        description: "Learn about Ab9dEcommerce - Your trusted source for our authentic products.",
        images: ["/logo.png"]
    }
};

export default async function AboutPage({ params }) {
    const { store } = await params;
    const page = await fetchPage("about", store);
    if (page?.body) return <CmsArticle title={page.title} html={page.body} />;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-emerald-600 text-white py-12 sm:py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">About Ab9dEcommerce</h1>
                    <p className="text-lg sm:text-xl md:text-2xl font-light">
                        Bringing the Purity of the Village to Your Doorstep
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
                {/* Introduction */}
                <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 md:p-12 mb-12">
                    <p className="text-lg text-gray-700 leading-relaxed">
                        Welcome to <span className="font-semibold text-emerald-600">AB9DECOMMERCE</span>, your trusted gateway to authentic, quality, and farm-fresh products. In an era of mass production and chemical additives, we are on a mission to reconnect urban households with the wholesome, untainted flavors of local communities.
                    </p>
                    <p className="text-lg text-gray-700 leading-relaxed mt-6">
                        The name <span className="font-semibold">AB9DECOMMERCE</span> (Gram to Ghor) reflects our core philosophy: sourcing the finest produce directly from the <span className="font-medium">Gram (Village)</span> and delivering it with love to your <span className="font-medium">Ghor (Home)</span>.
                    </p>
                </div>

                {/* Our Story */}
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-1 bg-emerald-600"></div>
                        <h2 className="text-3xl font-bold text-gray-900">Our Story</h2>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
                        <p className="text-lg text-gray-700 leading-relaxed">
                            AB9DECOMMERCE was founded with a simple yet powerful vision—to make "pure" the new standard. We realized that while the city offers convenience, it often lacks the nutritional integrity found in the countryside. We decided to bridge that gap. By working closely with local farmers and artisans, we ensure that every product we offer is a celebration of nature's bounty, free from harmful preservatives and synthetic chemicals.
                        </p>
                    </div>
                </div>

                {/* Why Choose Us */}
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-1 bg-emerald-600"></div>
                        <h2 className="text-3xl font-bold text-gray-900">Why Choose AB9DECOMMERCE?</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Authentic Sourcing</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We don't just buy from markets; we source from the roots. Our products are selected for their nutritional value and traditional processing methods.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Purity Guaranteed</h3>
                            <p className="text-gray-600 leading-relaxed">
                                From our our products to our hand-picked grains, we maintain a strict "zero-adulteration" policy.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Farm-to-Table Transparency</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We believe you should know where your food comes from. Our supply chain is designed to keep the journey from the farm to your kitchen as short and transparent as possible.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Quality at Every Step</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Our commitment to quality doesn't end at sourcing. We use secure packaging and follow rigorous safety standards to ensure your food arrives exactly as nature intended.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Our Values */}
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-1 bg-emerald-600"></div>
                        <h2 className="text-3xl font-bold text-gray-900">Our Values</h2>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                                    1
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Integrity</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        We are honest about what goes into our products. No hidden chemicals, no false claims.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                                    2
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Community</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        By choosing AB9DECOMMERCE, you are supporting local farmers and rural communities, helping to sustain traditional agriculture.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                                    3
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Customer Wellness</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        Your health is our priority. We curate products that nourish the body and soul.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="bg-emerald-600 text-white rounded-2xl p-8 md:p-12 text-center">
                    <h2 className="text-3xl font-bold mb-4">Join Our Journey</h2>
                    <p className="text-xl mb-8 opacity-90">
                        Experience the purity of village products in your home today.
                    </p>
                    <a
                        href={`/${store}`}
                        className="inline-flex items-center gap-2 bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                        Shop Now
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
