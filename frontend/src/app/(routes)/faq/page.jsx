"use client";
import { useState } from "react";
import { FiChevronDown, FiChevronUp, FiHelpCircle } from "react-icons/fi";

export default function FaqPage() {
    const [openIndex, setOpenIndex] = useState(null);

    const faqs = [
        {
            question: "Do you have a physical store?",
            answer: "We operate primarily online. Our showroom and warehouse details are listed on the Contact page."
        },
        {
            question: "Can I send a product as a gift?",
            answer: "Yes. Provide the recipient's delivery address and contact details at checkout. Gift orders may require advance payment."
        },
        {
            question: "What payment methods do you accept?",
            answer: "We accept major credit and debit cards, and other online payment options. Specific gateways are displayed at checkout."
        },
        {
            question: "Do you offer cash on delivery?",
            answer: "Cash on delivery may be available in selected regions. The option will appear at checkout if your address is eligible."
        },
        {
            question: "Can I order from outside the country?",
            answer: "Yes, we ship internationally. International shipping rates and timelines are calculated at checkout."
        },
        {
            question: "Are there any special discounts?",
            answer: "Yes — we run periodic promotions and bulk-order discounts. Sign up for the newsletter to stay updated."
        },
        {
            question: "What are the delivery charges?",
            answer: "Local delivery: $7\nRegional delivery: $10\nInternational delivery: $13\n\nNote: The shown charge applies regardless of order quantity."
        },
        {
            question: "How long will delivery take?",
            answer: "Local: 24–48 hours\nRegional: 48–72 hours\nInternational: 5–10 business days"
        },
        {
            question: "What if my order doesn't arrive on time?",
            answer: "Contact our support team as soon as possible and we'll resolve the issue immediately."
        },
        {
            question: "How do I report a complaint or share feedback?",
            answer: "Reach out via the Contact page or our support email. We respond to all queries within 24 hours."
        }
    ];

    const toggleFaq = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6">
                        <FiHelpCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Find answers to common questions about our products, services, and policies.
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md"
                        >
                            <button
                                onClick={() => toggleFaq(index)}
                                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-none focus:bg-gray-50 transition-colors"
                            >
                                <h3 className="text-lg font-semibold text-gray-800 pr-4">
                                    {faq.question}
                                </h3>
                                <div className="flex-shrink-0">
                                    {openIndex === index ? (
                                        <FiChevronUp className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                        <FiChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </button>
                            <div
                                className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                                    openIndex === index ? 'max-h-96 pb-5' : 'max-h-0'
                                }`}
                            >
                                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                                    {faq.answer}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 text-center bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-3">Still have questions?</h2>
                    <p className="text-gray-600 mb-6">
                        If you didn't find the answer you were looking for, get in touch with us.
                    </p>
                    <a
                        href="/contact"
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                        Contact Us
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
