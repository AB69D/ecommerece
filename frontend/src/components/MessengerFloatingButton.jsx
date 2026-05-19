"use client";
import { useState, useEffect } from "react";

export default function MessengerFloatingButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const messengerLink = "https://m.me/gram2ghor";

    return (
        <div
            className={`fixed bottom-24 right-6 z-50 transition-all duration-300 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}
        >
            <div className="relative">
                <a
                    href={messengerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setIsTooltipVisible(true)}
                    onMouseLeave={() => setIsTooltipVisible(false)}
                    className="flex items-center justify-center w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
                    aria-label="Chat on Messenger"
                >
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/>
                    </svg>
                </a>

                <div
                    className={`absolute bottom-full right-0 mb-3 whitespace-nowrap transition-all duration-200 ${
                        isTooltipVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                >
                    <div className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg relative">
                        <span>Chat on Messenger</span>
                        <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
