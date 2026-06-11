import Image from "next/image";
import { fetchPage } from "@/lib/dynamicContent";
import CmsArticle from "@/components/CmsArticle";

export default async function CorporateDealPage({ params }) {
    const { store } = await params;
    const page = await fetchPage("corporate-deal", store);
    if (page?.body) return <CmsArticle title={page.title} html={page.body} />;
    return (
        <div className="py-8 px-4 max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8 text-center">Corporate Deals</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {/* CEO Container */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-gray-100 relative">
                        <Image
                            src="/ceo.jpeg"
                            alt="CEO - Md. Moshreful Islam Sojib"
                            width={500}
                            height={500}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Md. Moshreful Islam Sojib</h2>
                        <p className="text-sm text-gray-500 mb-1">MSc & BSc in Zoology</p>
                        <p className="text-sm text-gray-500 mb-1">[Your Institution]</p>
                        <p className="text-sm font-semibold text-emerald-600 mt-3">Founder & CEO - Ab9dEcommerce</p>
                        <p className="text-sm text-gray-600 mt-2">Contact: +1 000 000 0000</p>
                    </div>
                </div>

                {/* MD Container */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-gray-100 relative">
                        <Image
                            src="/md.jpeg"
                            alt="MD - Md. Raju Hossain"
                            width={500}
                            height={500}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Md. Raju Hossain</h2>
                        <p className="text-sm text-gray-500 mb-1">BSc in Textile Engineering</p>
                        <p className="text-sm text-gray-500 mb-1">Pabna Textile Engineering College, Pabna (Affiliated BUTEX)</p>
                        <p className="text-sm font-semibold text-emerald-600 mt-3">Founder & MD - Ab9dEcommerce</p>
                        <p className="text-sm text-gray-600 mt-2">Contact: 01726-317392</p>
                    </div>
                </div>
            </div>

            {/* Contact Information */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 mb-12">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Contact Us</h2>
                <div className="space-y-2 text-gray-700">
                    <p><strong>Email:</strong> ab9d-ecommerce@gmail.com</p>
                    <p><strong>Phone:</strong> +1 000 000 0000, 01822-858283</p>
                    <p><strong>Products Exhibition Address:</strong> [Your Exhibition Address]</p>
                    <p><strong>Office Address:</strong> [Your Business Address]</p>
                    <p><strong>Order Time:</strong> Everyday 24/7</p>
                </div>
            </div>
        </div>
    );
}
