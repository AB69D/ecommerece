import { fetchPage } from "@/lib/dynamicContent";
import CmsArticle from "@/components/CmsArticle";

export const metadata = {
    title: "Privacy Policy | Ab9dEcommerce",
    description: "Read Ab9dEcommerce's Privacy Policy to understand how we collect, use, and protect your personal information when you use our products delivery service.",
    keywords: "privacy policy, Ab9dEcommerce privacy, data protection, personal information, GDPR compliance ",
    openGraph: {
        title: "Privacy Policy - Ab9dEcommerce",
        description: "Read Ab9dEcommerce's Privacy Policy to understand how we collect, use, and protect your personal information.",
        url: "https://example.com/privacy-policy",
        siteName: "Ab9dEcommerce",
        type: "website"
    }
};

export default async function PrivacyPolicyPage({ params }) {
    const { store } = await params;
    const page = await fetchPage("privacy-policy", store);
    if (page?.body) return <CmsArticle title={page.title} html={page.body} />;
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-emerald-600 text-white py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
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
                                1. Introduction
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                At <span className="font-semibold">AB9DECOMMERCE</span>, we are dedicated to bringing the purity of the village to your doorstep. We are committed to protecting your privacy and safeguarding your personal information. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of your information when you use our e-commerce platform for products and natural products. By using our services, you consent to the practices described in this policy.
                            </p>
                        </div>

                        {/* Section 2 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                                2. Information We Collect
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                We collect the following types of information to ensure a seamless "farm-to-home" experience:
                            </p>
                            <div className="ml-16 space-y-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">2.1. Personal Information</h3>
                                    <p className="text-gray-700 leading-relaxed">Includes your name, shipping address, email, and phone number provided during registration or checkout.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">2.2. Payment Data</h3>
                                    <p className="text-gray-700 leading-relaxed">Details required to process transactions. Payments are handled via secure third-party gateways (e.g., bKash, Nagad, SSLCommerz). AB9DECOMMERCE does not store your full card or mobile wallet credentials.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">2.3. Quality Assurance Media</h3>
                                    <p className="text-gray-700 leading-relaxed">To maintain our high quality standards, we may collect photos or unboxing videos provided by you to verify product quality or process return requests.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">2.4. Usage & Location Information</h3>
                                    <p className="text-gray-700 leading-relaxed">Precise location data (if enabled) to provide accurate delivery windows and browsing history to improve our product selection.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">2.5. Cookies</h3>
                                    <p className="text-gray-700 leading-relaxed">We use cookies to keep your cart saved and to understand how you navigate our village-to-urban marketplace.</p>
                                </div>
                            </div>
                        </div>

                        {/* Section 3 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                                3. How We Use Your Information
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                We use your personal information for the following purposes:
                            </p>
                            <div className="ml-16 space-y-3">
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">3.1. Order Fulfillment:</span> To process and deliver your products safely to your home.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">3.2. Customer Support:</span> To address inquiries regarding product freshness, sourcing, or delivery status.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">3.3. Marketing & Transparency:</span> To send updates on seasonal harvests, promotional offers, and order status notifications via SMS or email.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">3.4. Service Optimization:</span> To analyze customer preferences and ensure we are sourcing the products you need most.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">3.5. Legal Compliance:</span> To comply with applicable regulations in .</p>
                            </div>
                        </div>

                        {/* Section 4 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                                4. Sharing Your Information
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                We respect your data and never sell it to third parties. We share information only with:
                            </p>
                            <div className="ml-16 space-y-3">
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">4.1. Delivery Partners:</span> Trusted courier services who require your contact details for successful delivery.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">4.2. Service Providers:</span> Third parties who assist with payment processing, SMS gateways, and website analytics.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">4.3. Business Transfers:</span> In the event of a merger or acquisition, your data may be transferred to the new owner under the same privacy protections.</p>
                            </div>
                        </div>

                        {/* Section 5 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                                5. Data Security
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                AB9DECOMMERCE employs industry-standard security measures, including SSL encryption, to protect your personal information from unauthorized access, disclosure, or alteration.
                            </p>
                        </div>

                        {/* Section 6 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                                6. Your Choices
                            </h2>
                            <div className="ml-16 space-y-3">
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">6.1. Account Management:</span> You can update your address and contact details at any time by logging into your AB9DECOMMERCE account.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">6.2. Communication Preferences:</span> You may opt-out of marketing materials by using the "unsubscribe" link in our emails or contacting our support team.</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">6.3. Cookie Control:</span> You can manage or disable cookies through your browser settings.</p>
                            </div>
                        </div>

                        {/* Section 7 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">7</span>
                                7. Children's Privacy
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                Our services are intended for adults. We do not knowingly collect personal information from individuals under the age of 13.
                            </p>
                        </div>

                        {/* Section 8 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">8</span>
                                8. Changes to This Policy
                            </h2>
                            <p className="text-gray-700 leading-relaxed ml-11">
                                As we grow and add more village-sourced products, we may update this policy. All updates will be posted on this page with a revised effective date.
                            </p>
                        </div>

                        {/* Section 9 */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">9</span>
                                9. Contact Us
                            </h2>
                            <p className="text-gray-700 leading-relaxed mb-4 ml-11">
                                If you have any questions or concerns regarding this Privacy Policy, please contact us at:
                            </p>
                            <div className="ml-16 bg-gray-50 rounded-lg p-6">
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">AB9DECOMMERCE</span></p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Email:</span> ab9d-ecommerce@gmail.com</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Phone:</span> +1 000 000 0000, +1 000 000 0000</p>
                                <p className="text-gray-700 leading-relaxed"><span className="font-semibold">Address:</span> [Your Business Address]</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
