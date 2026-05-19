"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

export default function Showcase() {
    const [headers, setHeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [current, setCurrent] = useState(0);

    const sliderRef = useRef(null);

    useEffect(() => {
        const fetchHeaders = async () => {
            try {
                const res = await fetch(`/api/client/header/headers`);
                const data = await res.json();
                if (data.success) {
                    setHeaders(data.data);
                } else {
                    setError(data.message);
                }
            } catch (err) {
                setError("Failed to fetch header images");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHeaders();
    }, []);

    useEffect(() => {
        if (headers.length <= 1) return;
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % headers.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [headers.length]);

    const goTo = useCallback((index) => {
        setCurrent(index);
    }, []);

    if (loading) {
        return (
            <div className="mt-4 lg:mt-8 relative w-full aspect-[2/1] lg:!h-[62vh] overflow-hidden bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
        );
    }

    if (error) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center bg-gray-100">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    if (headers.length === 0) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center bg-gray-100">
                <p className="text-gray-500">No header images available</p>
            </div>
        );
    }

    return (
        <div className="mt-4 lg:mt-8 relative w-full aspect-[2/1] lg:!h-[62vh] overflow-hidden bg-gray-100">
            <div
                ref={sliderRef}
                className="flex h-full transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${current * 100}%)` }}
            >
                {headers.map((header, idx) => (
                    <div key={header._id} className="min-w-full h-full flex-shrink-0">
                        {header.url ? (
                            <a href={header.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                <img
                                    src={header.image}
                                    alt="Gram2Ghor banner"
                                    loading={idx === 0 ? "eager" : "lazy"}
                                    decoding={idx === 0 ? "sync" : "async"}
                                    fetchPriority={idx === 0 ? "high" : "auto"}
                                    className="w-full h-full object-cover"
                                />
                            </a>
                        ) : (
                            <img
                                src={header.image}
                                alt="Gram2Ghor banner"
                                loading={idx === 0 ? "eager" : "lazy"}
                                decoding={idx === 0 ? "sync" : "async"}
                                fetchPriority={idx === 0 ? "high" : "auto"}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                ))}
            </div>

            {headers.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                    {headers.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goTo(index)}
                            aria-label={`Go to slide ${index + 1}`}
                            className={`rounded-full transition-all duration-300 focus:outline-none ${index === current
                                    ? "w-6 h-3 bg-emerald-600 shadow-md"
                                    : "w-3 h-3 bg-white/60 hover:bg-white/90"
                                }`}
                        />
                    ))}
                </div>
            )}

            {headers.length > 1 && (
                <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            )}
        </div>
    );
}