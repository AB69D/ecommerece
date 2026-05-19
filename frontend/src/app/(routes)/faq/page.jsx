"use client";
import { useState } from "react";
import { FiChevronDown, FiChevronUp, FiHelpCircle } from "react-icons/fi";

export default function FaqPage() {
    const [openIndex, setOpenIndex] = useState(null);

    const faqs = [
        {
            question: "আপনাদের কি কোনো আউটলেট আছে?",
            answer: "না! আমাদের Gram2Ghor এর কোনো আউটলেট নেই কিন্তু পণ্যের প্রদর্শনী এবং সরাসরি পরিদর্শন করে পণ্য সংগ্রহের সুযোগ আছে।\n\nআমাদের প্রদর্শনীর স্থান:\nMeherba Plaza, Level-8, Room#J\n33, Topkhana Road, Segunbagicha, Dhaka-1000\n\nআমাদের ওয়ার হাউস:\n14/D, Kaderabad housing, Mohammadpur, Dhaka."
        },
        {
            question: "আপনাদের মাধ্যমে কি প্রিয়জনকে উপহার পাঠানো যাবে?",
            answer: "হ্যাঁ, ডেলিভারি ঠিকানা ও প্রাপকের তথ্য দিয়ে উপহার পাঠানো যাবে। গিফট অর্ডারের জন্য অ্যাডভান্স পেমেন্ট প্রযোজ্য।"
        },
        {
            question: "আপনাদের কোন কোন মাধ্যমে পেমেন্ট করতে হয়?",
            answer: "বিকাশ, নগদ ও রকেটের মাধ্যমে পেমেন্ট করতে পারবেন।\n\nবিকাশ, নগদ - 01822858380\nরকেট - 01743289610"
        },
        {
            question: "ক্যাশ অন ডেলিভারি সার্ভিস কি আছে?",
            answer: "হ্যাঁ, আমরা আপনাদের সুবিধার জন্য ক্যাশ অন ডেলিভারি সুবিধা দিচ্ছি। আপনি পণ্য হাতে পেয়ে দেখে পেমেন্ট করার সুযোগ পাচ্ছেন।"
        },
        {
            question: "বিদেশে বসে কি অর্ডার করা যাবে?",
            answer: "হ্যাঁ! অবশ্যই যাবে। আপনি WhatsApp ও ওয়েবসাইটের মাধ্যমে অর্ডার করতে পারেন।\n\nআমাদের WhatsApp নাম্বার - 01822858380"
        },
        {
            question: "প্রবাসী বাংলাদেশিদের জন্য কি কোনো বিশেষ ডিসকাউন্ট রয়েছে?",
            answer: "হ্যাঁ, একসাথে ৫০০০+ টাকার বেশি অর্ডার করলে রয়েছে বিশেষ ডিসকাউন্ট।"
        },
        {
            question: "ডেলিভারি চার্জ কত?",
            answer: "ঢাকার মধ্যে: ৭০ টাকা\nঢাকার মধ্যে একই দিনে: ১০০ টাকা\nঢাকার পার্শবর্তী এলাকায়: ১০০ টাকা\nঢাকার বাইরে: ১৩০ টাকা\n\nবিঃদ্রঃ একইসাথে যত পরিমাণ পণ্যই অর্ডার করুণ না কেনো ডেলিভারি চার্জ আর যুক্ত হবে না। অর্থাৎ উপরে উল্লেখিত চার্জই থাকবে ১০ কেজি অর্ডার করলেও।"
        },
        {
            question: "অর্ডার করলে পণ্য কতদিনে হাতে পেতে পারি?",
            answer: "ঢাকার মধ্যে: ২৪ থেকে ৪৮ ঘণ্টা\nঢাকার বাহিরে: ৪৮ থেকে ৭২ ঘণ্টা"
        },
        {
            question: "সঠিক সময়ে পণ্য হাতে না পেলে কি করবো?",
            answer: "কল করে জানানোর সাথে সাথে আমাদের সাপোর্ট টিম দ্রুত ব্যবস্থা নিবে।"
        },
        {
            question: "পণ্য বা সেবা নিয়ে কোন অভিযোগ ও পরামর্শ থাকলে কিভাবে জানাবো?",
            answer: "যেকোন অভিযোগ ও পরামর্শ থাকলে আমাদের সাপোর্ট টিম এর সাথে যোগাযোগ করা মাত্রই দ্রুত সমাধান করবো।\n\nফোন: 01822858283"
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
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">প্রায়শই জিজ্ঞাসিত প্রশ্নাবলী</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        আমাদের পণ্য, সেবা এবং নীতিমালা সম্পর্কে সাধারণ প্রশ্নের উত্তর খুঁজুন।
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
                    <h2 className="text-2xl font-semibold text-gray-800 mb-3">আরও প্রশ্ন আছে?</h2>
                    <p className="text-gray-600 mb-6">
                        আপনার প্রশ্নের উত্তর না পেলে আমাদের সাথে যোগাযোগ করুন।
                    </p>
                    <a
                        href="/contact"
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                        যোগাযোগ করুন
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
