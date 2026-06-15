"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FiStar, FiImage, FiVideo, FiX, FiCheck } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import StarRating from "./StarRating.jsx";
import { invalidateRating } from "@/lib/ratings.js";
import { useFeature } from "@/hooks/useSiteSettings";

export default function ProductReviews({ productId, productName }) {
    const reviewsEnabled = useFeature("productReviews");
    const params = useParams();
    const store = params?.store || "";
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // form state
    const [name, setName] = useState("");
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [media, setMedia] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const fetchReviews = async () => {
        if (!productId) return;
        try {
            const res = await fetch(`/api/client/review/product/${productId}`, {
                headers: { 'X-Tenant': store },
                cache: 'no-store',
            });
            const json = res.ok ? await res.json() : null;
            if (json?.success) setData(json.data);
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchReviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    const handleMediaSelect = (e) => {
        const files = Array.from(e.target.files);
        const next = [...media, ...files].slice(0, 5);
        setMedia(next);
        setPreviews(
            next.map((file) => ({
                url: URL.createObjectURL(file),
                type: file.type.startsWith("video/") ? "video" : "image"
            }))
        );
    };

    const removeMedia = (index) => {
        setMedia(media.filter((_, i) => i !== index));
        setPreviews(previews.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !comment.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("rating", String(rating));
            fd.append("comment", comment.trim());
            fd.append("productId", productId);
            media.forEach((file) => fd.append("media", file));

            const res = await fetch(`/api/client/review/create`, { method: "POST", body: fd, headers: { 'X-Tenant': store } });
            const json = await res.json();
            if (json?.success) {
                setSubmitted(true);
                setName("");
                setRating(5);
                setComment("");
                setMedia([]);
                setPreviews([]);
                invalidateRating(productId);
                await fetchReviews();
                setTimeout(() => {
                    setSubmitted(false);
                    setShowForm(false);
                }, 1800);
            } else {
                setError(json?.message || "Failed to submit review");
            }
        } catch {
            setError("Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    };

    const average = data?.average || 0;
    const count = data?.count || 0;
    const distribution = data?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const reviews = data?.reviews || [];

    // Admin turned reviews off — hide the whole section.
    if (!reviewsEnabled) return null;

    return (
        <section className="mt-10 sm:mt-14 border-t border-gray-200 pt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Ratings & Reviews</h2>

            {/* Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
                <div className="flex flex-col items-center sm:items-start sm:pr-8 sm:border-r border-gray-200">
                    <div className="text-4xl font-bold text-gray-900">{average.toFixed(1)}</div>
                    <StarRating value={average} size="md" className="mt-1" />
                    <p className="text-sm text-gray-500 mt-1">
                        {count} {count === 1 ? "review" : "reviews"}
                    </p>
                </div>

                <div className="flex-1 max-w-sm w-full">
                    {[5, 4, 3, 2, 1].map((star) => {
                        const c = distribution[star] || 0;
                        const pct = count > 0 ? (c / count) * 100 : 0;
                        return (
                            <div key={star} className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                <span className="w-3">{star}</span>
                                <FaStar className="w-3 h-3 text-yellow-400" />
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-6 text-right">{c}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="sm:ml-auto">
                    <button
                        onClick={() => setShowForm((s) => !s)}
                        className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                        {showForm ? "Close" : "Write a Review"}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="mb-8 p-5 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-200">
                    {submitted ? (
                        <div className="text-center py-4">
                            <FiCheck className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                            <p className="text-lg font-semibold text-emerald-800">Thank you for your review!</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="flex items-center gap-2 mb-3">
                                <FiStar className="w-5 h-5 text-yellow-500" />
                                <h3 className="text-lg font-bold text-gray-800">
                                    Review {productName || "this product"}
                                </h3>
                            </div>

                            <div className="flex items-center gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setRating(i)}
                                        onMouseEnter={() => setHoverRating(i)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        aria-label={`${i} star${i > 1 ? "s" : ""}`}
                                    >
                                        <FaStar
                                            className={`w-7 h-7 transition-colors ${
                                                i <= (hoverRating || rating) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"
                                            }`}
                                        />
                                    </button>
                                ))}
                                <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
                            </div>

                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required
                                className="w-full px-4 py-2.5 mb-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            />

                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Share your experience with this product..."
                                rows={3}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                            />

                            {previews.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {previews.map((preview, i) => (
                                        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                            {preview.type === "video" ? (
                                                <video src={preview.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={preview.url} alt="" className="w-full h-full object-cover" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeMedia(i)}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                                            >
                                                <FiX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <label className="mt-3 flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-emerald-600 transition-colors w-fit">
                                <FiImage className="w-4 h-4" />
                                <FiVideo className="w-4 h-4" />
                                <span>Add photos or videos (up to 5)</span>
                                <input type="file" accept="image/*,video/*" multiple onChange={handleMediaSelect} className="hidden" />
                            </label>

                            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

                            <button
                                type="submit"
                                disabled={submitting || !name.trim() || !comment.trim()}
                                className="mt-3 w-full sm:w-auto px-6 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                            >
                                {submitting ? "Submitting..." : "Submit Review"}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Review list */}
            {loading ? (
                <p className="text-gray-400 text-sm">Loading reviews...</p>
            ) : reviews.length === 0 ? (
                <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this product!</p>
            ) : (
                <div className="space-y-5">
                    {reviews.map((review) => (
                        <div key={review._id} className="border-b border-gray-100 pb-5 last:border-0">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-sm">
                                    {(review.name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">{review.name}</p>
                                    <StarRating value={review.rating} size="sm" />
                                </div>
                                <span className="ml-auto text-xs text-gray-400">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed mt-2">{review.comment}</p>
                            {review.media && review.media.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {review.media.map((m, i) => (
                                        <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                                            {m.type === "video" ? (
                                                <video src={m.url} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
