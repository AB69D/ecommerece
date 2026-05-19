import { FiMapPin, FiPhone, FiMail, FiClock } from "react-icons/fi";
import { ContactForm } from "./ContactForm";

export const metadata = {
    title: "Contact Gram2Ghor | Get in Touch with Us",
    description: "Contact Gram2Ghor for any queries about our organic food products. Reach us at Rampura, Dhaka, Bangladesh.",
    keywords: "contact Gram2Ghor, Gram2Ghor phone number, Gram2Ghor email, organic food contact Bangladesh",
    openGraph: {
        title: "Contact Gram2Ghor",
        description: "Contact Gram2Ghor for any queries about our organic food products.",
        url: "https://gram2ghor.com/contact",
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
        title: "Contact Gram2Ghor",
        description: "Contact Gram2Ghor for any queries about our organic food products.",
        images: ["/logo.png"]
    }
};

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-emerald-600 text-white py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
                    <p className="text-xl opacity-90">We'd love to hear from you</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Contact Information */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
                        <p className="text-gray-600 mb-8">
                            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
                        </p>

                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FiMapPin className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">Address</h3>
                                    <p className="text-gray-600">14/D, Kaderabad Housing, Mohammadpur, Dhaka</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FiPhone className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">Phone</h3>
                                    <p className="text-gray-600">01822858380, 01822-858283</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FiMail className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">Email</h3>
                                    <p className="text-gray-600">gram2ghor@gmail.com</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FiClock className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">Working Hours</h3>
                                    <p className="text-gray-600">24/7 Online Support</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <ContactForm />
                </div>
            </div>
        </div>
    );
}
