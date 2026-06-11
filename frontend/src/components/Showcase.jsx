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
            <div className="mt-4 lg:mt-8 relative w-full aspect-[16/10] sm:aspect-[2/1] lg:!h-[62vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
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
        <div className="relative isolate mt-4 lg:mt-8">
            {/* Soft brand glow radiating behind the hero for a premium framed look */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-70"
                style={{
                    background:
                        "radial-gradient(55% 60% at 18% 12%, color-mix(in srgb, var(--theme-primary) 38%, transparent), transparent 70%), radial-gradient(50% 55% at 88% 92%, color-mix(in srgb, var(--theme-accent) 32%, transparent), transparent 70%)",
                }}
            />
            <div className="relative w-full aspect-[16/10] sm:aspect-[2/1] lg:!h-[62vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-gray-100 shadow-2xl shadow-emerald-900/15 ring-1 ring-black/5">
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
                                    alt="Ab9dEcommerce banner"
                                    loading={idx === 0 ? "eager" : "lazy"}
                                    decoding={idx === 0 ? "sync" : "async"}
                                    fetchPriority={idx === 0 ? "high" : "auto"}
                                    className="w-full h-full object-cover"
                                />
                            </a>
                        ) : (
                            <img
                                src={header.image}
                                alt="Ab9dEcommerce banner"
                                loading={idx === 0 ? "eager" : "lazy"}
                                decoding={idx === 0 ? "sync" : "async"}
                                fetchPriority={idx === 0 ? "high" : "auto"}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Permanent inset frame + bottom vignette for a premium, legible hero */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl ring-1 ring-inset ring-white/10" />
            <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

            {headers.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm ring-1 ring-white/15">
                    {headers.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goTo(index)}
                            aria-label={`Go to slide ${index + 1}`}
                            className="rounded-full transition-all duration-300 focus:outline-none"
                            style={
                                index === current
                                    ? { width: "1.75rem", height: "0.6rem", backgroundColor: "var(--theme-accent)", boxShadow: "0 1px 6px rgba(0,0,0,0.35)" }
                                    : { width: "0.6rem", height: "0.6rem", backgroundColor: "rgba(255,255,255,0.7)" }
                            }
                        />
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}