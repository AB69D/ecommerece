"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { FaStar, FaStarHalfAlt, FaRegStar, FaQuoteLeft } from "react-icons/fa";
import { getReviews } from "@/utils/review";
import { useFeature } from "@/hooks/useSiteSettings";

const renderStars = (rating) => {
    const stars = [];
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
        if (i < full) {
            stars.push(<FaStar key={i} className="text-yellow-400 w-3 h-3 sm:w-4 sm:h-4" />);
        } else if (i === full && half) {
            stars.push(<FaStarHalfAlt key={i} className="text-yellow-400 w-3 h-3 sm:w-4 sm:h-4" />);
        } else {
            stars.push(<FaRegStar key={i} className="text-yellow-400 w-3 h-3 sm:w-4 sm:h-4" />);
        }
    }
    return stars;
};

export default function CustomerReviews() {
    const reviewsEnabled = useFeature("productReviews");
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [current, setCurrent] = useState(0);
    const sliderRef = useRef(null);

    useEffect(() => {
        if (!reviewsEnabled) {
            setLoading(false);
            return;
        }
        const fetchReviews = async () => {
            try {
                const result = await getReviews();
                if (result.success) {
                    setReviews(result.data);
                } else if (result.error) {
                    setError(result.error);
                }
            } catch (err) {
                setError("Failed to load reviews");
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [reviewsEnabled]);

    useEffect(() => {
        if (reviews.length <= 1) return;
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % reviews.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [reviews.length]);

    const goTo = useCallback((index) => {
        setCurrent(index);
    }, []);

    const goNext = useCallback(() => {
        setCurrent((prev) => (prev + 1) % reviews.length);
    }, [reviews.length]);

    const goPrev = useCallback(() => {
        setCurrent((prev) => (prev - 1 + reviews.length) % reviews.length);
    }, [reviews.length]);

    // Admin turned reviews off — hide the testimonials carousel entirely.
    if (!reviewsEnabled) return null;

    if (loading) {
        return (
            <div className="w-full py-16 flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Loading reviews...</p>
                </div>
            </div>
        );
    }

    if (error || reviews.length === 0) {
        return null;
    }

    return (
        <section className="rv-section">
            <style>{`
                .rv-section {
                    width: 100%;
                    padding: 40px 16px 32px;
                    box-sizing: border-box;
                    background: #f8f9fa;
                }
 
                .rv-heading {
                    text-align: center;
                    font-size: 20px;
                    font-weight: 700;
                    color: #111827;
                    margin: 0 0 20px;
                }
 
                /* Wrapper only handles the dot nav — no overflow clipping here */
                .rv-wrapper {
                    position: relative;
                    max-width: 720px;
                    margin: 0 auto;
                }
 
                /* The visible card — clips the sliding track */
                .rv-card {
                    border-radius: 16px;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
                    overflow: hidden;
                }
 
                /* Flex row that slides */
                .rv-track {
                    display: flex;
                    width: 100%;
                    transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
                    will-change: transform;
                }
 
                /* Each slide — padding keeps content away from edges */
                .rv-slide {
                    min-width: 100%;
                    width: 100%;
                    flex-shrink: 0;
                    box-sizing: border-box;
                    padding: 32px 24px 28px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .rv-media-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    justify-content: center;
                    margin-bottom: 14px;
                    width: 100%;
                    max-width: 480px;
                }

                .rv-media-item {
                    width: 72px;
                    height: 72px;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                    flex-shrink: 0;
                    cursor: pointer;
                }

                .rv-media-item img,
                .rv-media-item video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                @media (min-width: 640px) {
                    .rv-media-item {
                        width: 88px;
                        height: 88px;
                        border-radius: 12px;
                    }
                }
 
                .rv-quote {
                    color: #a7f3d0;
                    margin-bottom: 12px;
                    flex-shrink: 0;
                }
 
                /* Comment — word-wrap so long text never overflows */
                .rv-comment {
                    font-size: 14px;
                    line-height: 1.8;
                    color: #4b5563;
                    margin: 0 0 16px;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    white-space: normal;
                    width: 100%;
                    max-width: 480px;
                }
 
                .rv-stars {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    margin-bottom: 16px;
                }
 
                .rv-author-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 100%;
                }
 
                .rv-avatar {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    background: #d1fae5;
                    border: 1px solid #a7f3d0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 700;
                    color: #065f46;
                    flex-shrink: 0;
                }
 
                .rv-author-info {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    min-width: 0; /* allows text-overflow to work */
                }
 
                .rv-author-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #111827;
                    margin: 0 0 2px;
                    /* let name wrap instead of clipping */
                    white-space: normal;
                    word-break: break-word;
                    text-align: left;
                }
 
                .rv-author-date {
                    font-size: 12px;
                    color: #9ca3af;
                    margin: 0;
                    text-align: left;
                    white-space: nowrap;
                }
 
                /* Nav row sits BELOW the card, centered */
                .rv-nav-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-top: 16px;
                }
 
                .rv-nav-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    color: #6b7280;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: background 0.15s, border-color 0.15s, color 0.15s;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
                }
 
                .rv-nav-btn:hover {
                    background: #f0fdf4;
                    border-color: #6ee7b7;
                    color: #065f46;
                }
 
                .rv-nav-btn:active {
                    transform: scale(0.95);
                }
 
                .rv-dots {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
 
                .rv-dot {
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    height: 8px;
                    border-radius: 99px;
                    transition: width 0.3s ease, background 0.3s ease;
                }
 
                .rv-dot-inactive {
                    width: 8px;
                    background: #d1d5db;
                }
 
                .rv-dot-inactive:hover {
                    background: #9ca3af;
                }
 
                .rv-dot-active {
                    width: 22px;
                    background: #059669;
                }
 
                @media (min-width: 640px) {
                    .rv-section { padding: 56px 24px 40px; }
                    .rv-heading { font-size: 24px; margin-bottom: 28px; }
                    .rv-slide { padding: 44px 52px 40px; }
                    .rv-comment { font-size: 15px; }
                    .rv-author-name { font-size: 15px; }
                }
            `}</style>

            <h2 className="rv-heading">What Our Customers Say</h2>

            <div className="rv-wrapper">
                <div className="rv-card">
                    <div
                        ref={sliderRef}
                        className="rv-track"
                        style={{ transform: `translateX(-${current * 100}%)` }}
                    >
                        {reviews.map((review) => (
                            <div key={review._id} className="rv-slide">
                                <FaQuoteLeft className="rv-quote" size={22} />
                                {review.media && review.media.length > 0 && (
                                    <div className="rv-media-row">
                                        {review.media.map((item, i) => (
                                            <div key={i} className="rv-media-item">
                                                {item.type === 'video' ? (
                                                    <video src={item.url} muted playsInline />
                                                ) : (
                                                    <img src={item.url} alt="Customer review photo" loading="lazy" decoding="async" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="rv-comment">{review.comment}</p>
                                <div className="rv-stars">
                                    {renderStars(review.rating)}
                                </div>
                                <div className="rv-author-row">
                                    <div className="rv-avatar">
                                        {review.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="rv-author-info">
                                        <p className="rv-author-name">{review.name}</p>
                                        <p className="rv-author-date">
                                            {new Date(review.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {reviews.length > 1 && (
                    <div className="rv-nav-row">
                        <button onClick={goPrev} className="rv-nav-btn" aria-label="Previous review">
                            <FiArrowLeft size={16} />
                        </button>
                        <div className="rv-dots">
                            {reviews.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goTo(index)}
                                    aria-label={`Go to review ${index + 1}`}
                                    className={`rv-dot ${index === current ? "rv-dot-active" : "rv-dot-inactive"}`}
                                />
                            ))}
                        </div>
                        <button onClick={goNext} className="rv-nav-btn" aria-label="Next review">
                            <FiArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
