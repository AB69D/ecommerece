"use client";
import { FaPhoneAlt } from "react-icons/fa";
import { PiWhatsappLogoBold } from "react-icons/pi";

export default function HeaderTop() {
    return (
        <div className="bg-black mb-2 sm:mb-3">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 py-2 sm:py-1.5">
                    <p className="text-white text-xs sm:text-sm font-medium text-center">
                        আমাদের যে কোন পণ্য অর্ডার করতে Whatsapp করুন বা কল করুন
                    </p>
                    <div className="flex items-center gap-4 sm:gap-6">
                        <a
                            href="tel:+8801822858380"
                            className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                        >
                            <FaPhoneAlt className="text-sm text-green-500" />
                            <p className="text-xs sm:text-sm font-medium">+8801822858380</p>
                        </a>
                        <a
                            href="https://wa.me/8801822858283"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-white hover:text-green-400 transition-colors"
                        >
                            <PiWhatsappLogoBold className="text-sm text-green-500" />
                            <p className="text-xs sm:text-sm font-medium">+8801822858283</p>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};