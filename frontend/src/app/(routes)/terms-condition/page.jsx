import { fetchPage } from "@/lib/dynamicContent";
import CmsArticle from "@/components/CmsArticle";

export const metadata = {
    title: "Terms & Conditions | Ab9dEcommerce",
    description: "Read the Terms & Conditions for using Ab9dEcommerce's website and services. Learn about our policies, user responsibilities, and legal agreements.",
    keywords: "terms and conditions, Ab9dEcommerce terms, user agreement, service terms, e-commerce policy",
    openGraph: {
        title: "Terms & Conditions - Ab9dEcommerce",
        description: "Read the Terms & Conditions for using Ab9dEcommerce's website and services.",
        url: "https://example.com/terms-condition",
        siteName: "Ab9dEcommerce",
        type: "website"
    }
};

export default async function TermsConditionPage() {
    const page = await fetchPage("terms-condition");
    if (page?.body) return <CmsArticle title={page.title} html={page.body} />;
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-emerald-600 text-white py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
                    <p className="text-lg opacity-90">Effective Date: April 8, 2026</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
                    <div className="prose prose-lg max-w-none">
                        {/* Section 1 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                                1. General Information
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                This website is owned and operated by <span className="font-semibold">AB9DECOMMERCE</span>, located at: [Your Business Address]. By accessing this website and using our services, you agree to comply with and be bound by these Terms & Conditions.
                            </p>
                        </div>

                        {/* Section 2 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                                2. Eligibility
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                By using our services, you confirm that:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2 ml-16">
                                <li>You are at least 18 years of age.</li>
                                <li>You are legally capable of entering into binding agreements.</li>
                                <li>All information provided during registration or checkout is accurate and complete.</li>
                            </ul>
                        </div>

                        {/* Section 3 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                                3. Product Authenticity & Variations
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                AB9DECOMMERCE specializes in natural and products. Please note: Because our products are often sourced directly from villages and processed naturally, slight variations in color, texture, aroma, or packaging may occur. We strive for accuracy in product descriptions, but availability and specifications are subject to change without prior notice based on seasonal harvests.
                            </p>
                        </div>

                        {/* Section 4 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                                4. Pricing & Payment
                            </h2>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-3 ml-11">
                                <li>All prices are listed in your local currency.</li>
                                <li>Prices are subject to change without notice due to market fluctuations in sourcing.</li>
                                <li>Payments must be made through our authorized channels: Cash on Delivery (COD), Mobile Banking (bKash, Nagad), or approved SSLCommerz gateways.</li>
                                <li>AB9DECOMMERCE reserves the right to cancel orders and issue refunds in the event of technical pricing errors.</li>
                            </ul>
                        </div>

                        {/* Section 5 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                                5. Order Acceptance & Cancellation
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                We reserve the right to cancel or refuse any order for reasons including:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2 ml-16">
                                <li>Product unavailability or stock depletion.</li>
                                <li>Incomplete or unverifiable shipping addresses.</li>
                                <li>Suspected fraudulent, unauthorized, or illegal activity.</li>
                            </ul>
                        </div>

                        {/* Section 6 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                                6. Shipping & Delivery
                            </h2>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-3 ml-11">
                                <li>Delivery timelines are estimates and vary based on the delivery location within your service area.</li>
                                <li>Once a shipment is handed over to our third-party courier partners, AB9DECOMMERCE is not held liable for delays caused by the courier or external factors (e.g., weather or strikes).</li>
                            </ul>
                        </div>

                        {/* Section 7 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">7</span>
                                7. Returns, Refunds & Claims
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                To maintain high standards of food hygiene, our return policy is as follows:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-3 ml-16">
                                <li>Returns are only accepted for Damaged, Defective, or Incorrect items.</li>
                                <li><span className="font-semibold">Mandatory Requirement:</span> You must provide a clear unboxing video recorded at the time of delivery/opening to validate a claim. Without video proof, AB9DECOMMERCE reserves the right to reject refund or replacement requests.</li>
                                <li>Issues must be reported to our customer service within 24 hours of receipt.</li>
                            </ul>
                        </div>

                        {/* Section 8 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">8</span>
                                8. Account Security
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                You are responsible for maintaining the confidentiality of your account password and activity. AB9DECOMMERCE reserves the right to suspend or terminate accounts that show suspicious or unauthorized behavior.
                            </p>
                        </div>

                        {/* Section 9 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">9</span>
                                9. Prohibited Activities
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                You are strictly prohibited from:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2 ml-16">
                                <li>Using this website for any fraudulent or harmful purposes.</li>
                                <li>Attempting to hack, disrupt, or gain unauthorized access to our servers.</li>
                                <li>Scraping or copying website content (images, text, or logos) for commercial use without our written consent.</li>
                            </ul>
                        </div>

                        {/* Section 10 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">10</span>
                                10. Intellectual Property
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                All website content—including the AB9DECOMMERCE logo, product photography, graphics, and text—is the exclusive property of AB9DECOMMERCE. Unauthorized reproduction or distribution is strictly prohibited.
                            </p>
                        </div>

                        {/* Section 11 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">11</span>
                                11. Limitation of Liability
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                AB9DECOMMERCE shall not be held liable for:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2 ml-16">
                                <li>Indirect, incidental, or consequential damages arising from the use of our website.</li>
                                <li>Delays caused by third-party delivery services.</li>
                                <li>Misuse of products or failure to follow storage instructions provided on products.</li>
                            </ul>
                        </div>

                        {/* Section 12 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">12</span>
                                12. Governing Law
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                These Terms & Conditions are governed by and construed in accordance with applicable local laws.
                            </p>
                        </div>

                        {/* Section 13 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">13</span>
                                13. Contact Information
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                For any questions regarding these Terms, please contact us at:
                            </p>
                            <div className="ml-16 bg-gray-50 rounded-lg p-6">
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Brand:</span> AB9DECOMMERCE</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Address:</span> [Your Business Address]</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Phone:</span> +1 000 000 0000</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Email:</span> ab9d-ecommerce@gmail.com</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
