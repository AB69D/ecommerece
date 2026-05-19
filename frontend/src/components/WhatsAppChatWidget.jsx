"use client";
import { useState, useEffect, useRef } from "react";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { FiX, FiSend, FiMinimize2 } from "react-icons/fi";

export default function WhatsAppChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [isVisible, setIsVisible] = useState(false);
    const messagesEndRef = useRef(null);

    const whatsappNumber = "8801618566586";
    const defaultMessage = "হ্যালো, আমি একটি পণ্য সম্পর্কে জানতে চাই।";

    useEffect(() => {
        setIsVisible(true);
        const savedHistory = localStorage.getItem('whatsapp_chat_history');
        if (savedHistory) {
            setChatHistory(JSON.parse(savedHistory));
        }
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
        setIsMinimized(false);
    };

    const minimizeChat = () => {
        setIsMinimized(true);
    };

    const sendMessage = () => {
        if (!message.trim()) return;

        const newMessage = {
            id: Date.now(),
            text: message,
            sender: "user",
            time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
        };

        const updatedHistory = [...chatHistory, newMessage];
        setChatHistory(updatedHistory);
        localStorage.setItem('whatsapp_chat_history', JSON.stringify(updatedHistory));
        
        setMessage("");

        setTimeout(() => {
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
        }, 100);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setChatHistory([]);
        localStorage.removeItem('whatsapp_chat_history');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && !isMinimized && (
                <div className="mb-4 w-[320px] sm:w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[450px]">
                    <div className="bg-emerald-600 text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <PiWhatsappLogoBold className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Gram2Ghor Support</h3>
                                <p className="text-xs text-emerald-100">Online</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearChat}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                                title="Clear chat"
                            >
                                <FiMinimize2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={minimizeChat}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                                aria-label="Minimize"
                            >
                                <FiMinimize2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={toggleChat}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                                aria-label="Close chat"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        {chatHistory.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <PiWhatsappLogoBold className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h4 className="font-medium text-gray-800 mb-2">Welcome to Gram2Ghor!</h4>
                                <p className="text-sm text-gray-500 mb-4">
                                    Hi! Send us a message and we&apos;ll get back to you on WhatsApp.
                                </p>
                                <div className="bg-white rounded-lg p-3 text-sm text-gray-600 border border-gray-200">
                                    <p className="font-medium text-emerald-600 mb-1">Quick response tip:</p>
                                    <p>Type your question and we&apos;ll reply instantly on WhatsApp!</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {chatHistory.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                                msg.sender === 'user'
                                                    ? 'bg-emerald-600 text-white rounded-br-md'
                                                    : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                                            }`}
                                        >
                                            <p>{msg.text}</p>
                                            <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-emerald-200' : 'text-gray-400'}`}>
                                                {msg.time}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-white border-t border-gray-100">
                        <div className="flex items-end gap-2">
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type a message..."
                                className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 max-h-24"
                                rows={1}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!message.trim()}
                                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl transition-colors"
                                aria-label="Send message"
                            >
                                <FiSend className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isOpen && isMinimized && (
                <div className="mb-4 w-[280px] bg-white rounded-xl shadow-lg p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                <PiWhatsappLogoBold className="w-5 h-5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Gram2Ghor Support</span>
                        </div>
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <FiMinimize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={toggleChat}
                className={`relative w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group`}
                aria-label="Open WhatsApp chat"
            >
                {isOpen ? (
                    <FiX className="w-7 h-7 text-white" />
                ) : (
                    <PiWhatsappLogoBold className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
                )}
                
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
            </button>
        </div>
    );
}