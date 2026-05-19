"use client";
import { useState, useEffect } from "react";
import { PiWhatsappLogoBold } from "react-icons/pi";

export default function WhatsAppFloatingButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const whatsappNumber = "8801618566586";
    const defaultMessage = "হ্যালো, আমি একটি পণ্য সম্পর্কে জানতে চাই।";
    const encodedMessage = encodeURIComponent(defaultMessage);
    
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}
        >
            <div className="relative">
                <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setIsTooltipVisible(true)}
                    onMouseLeave={() => setIsTooltipVisible(false)}
                    className="flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
                    aria-label="Chat on WhatsApp"
                >
                    <PiWhatsappLogoBold className="w-7 h-7 text-white" />
                </a>

                <div
                    className={`absolute bottom-full right-0 mb-3 whitespace-nowrap transition-all duration-200 ${
                        isTooltipVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                >
                    <div className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg relative">
                        <span>Chat on WhatsApp</span>
                        <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}