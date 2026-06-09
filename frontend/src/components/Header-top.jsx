"use client";
import { usePathname } from "next/navigation";
import { FaPhoneAlt } from "react-icons/fa";
import { PiWhatsappLogoBold } from "react-icons/pi";

export default function HeaderTop() {
    const pathname = usePathname();
    // The POS terminal is a self-contained full-screen app — no storefront chrome.
    if (pathname?.startsWith("/pos")) return null;
    return (
        <div className="bg-black mb-2 sm:mb-3">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 py-2 sm:py-1.5">
                    <p className="text-white text-xs sm:text-sm font-medium text-center">
                        Order any of our products via WhatsApp or call us
                    </p>
                    <div className="flex items-center gap-4 sm:gap-6">
                        <a
                            href="tel:+10000000000"
                            className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                        >
                            <FaPhoneAlt className="text-sm text-green-500" />
                            <p className="text-xs sm:text-sm font-medium">+1 000 000 0000</p>
                        </a>
                        <a
                            href="https://wa.me/10000000000"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                        >
                            <PiWhatsappLogoBold className="text-sm text-green-500" />
                            <p className="text-xs sm:text-sm font-medium">+1 000 000 0000</p>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};