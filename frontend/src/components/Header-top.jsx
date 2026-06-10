"use client";
import { usePathname } from "next/navigation";
import { FaPhoneAlt } from "react-icons/fa";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { useWhatsApp } from "@/hooks/useWhatsApp";

export default function HeaderTop() {
    const pathname = usePathname();
    const wa = useWhatsApp();
    // The POS terminal is a self-contained full-screen app — no storefront chrome.
    if (pathname?.startsWith("/pos")) return null;

    const phone = wa.contactPhone;
    const showCall = Boolean(phone);
    const showWhatsApp = wa.enabled;

    // Nothing to show until the admin sets a contact phone and/or enables WhatsApp.
    if (!showCall && !showWhatsApp) return null;

    return (
        <div className="bg-black mb-2 sm:mb-3">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 py-2 sm:py-1.5">
                    <p className="text-white text-xs sm:text-sm font-medium text-center">
                        Order any of our products via WhatsApp or call us
                    </p>
                    <div className="flex items-center gap-4 sm:gap-6">
                        {showCall && (
                            <a
                                href={`tel:${phone.replace(/\s/g, "")}`}
                                className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                            >
                                <FaPhoneAlt className="text-sm text-green-500" />
                                <p className="text-xs sm:text-sm font-medium">{phone}</p>
                            </a>
                        )}
                        {showWhatsApp && (
                            <a
                                href={wa.chatUrl("Hi, I'd like to order a product.")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                            >
                                <PiWhatsappLogoBold className="text-sm text-green-500" />
                                <p className="text-xs sm:text-sm font-medium">WhatsApp</p>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};