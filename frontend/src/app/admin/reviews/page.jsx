"use client";
import { authFetch } from "@/services/api";
import { useState, useEffect } from "react";
import { FiStar, FiTrash2, FiMessageSquare, FiAlertCircle } from "react-icons/fi";
import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";

const renderStars = (rating) => {
    const stars = [];
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    for (let i = 0; i < 5; i++) {
        if (i < full) stars.push(<FaStar key={i} className="text-yellow-400 w-3 h-3" />);
        else if (i === full && half) stars.push(<FaStarHalfAlt key={i} className="text-yellow-400 w-3 h-3" />);
        else stars.push(<FaRegStar key={i} className="text-yellow-400 w-3 h-3" />);
    }
    return stars;
};

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        try {
            const res = await authFetch(`/api/admin/review/all`);
            const data = await res.json();
            if (data.success) setReviews(data.data);
        } catch (err) {
            console.error("Failed to fetch reviews", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this review?")) return;
        try {
            const res = await authFetch(`/api/admin/review/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setReviews(prev => prev.filter(r => r._id !== id));
            } else {
                alert(data.message || "Failed to delete");
            }
        } catch (err) {
            alert("Failed to delete review");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-gray-800">Customer Reviews</h3>
                    <p className="text-gray-500 mt-1">Manage all customer reviews ({reviews.length})</p>
                </div>
            </div>

            {reviews.length === 0 ? (
                <div className="text-center py-16">
                    <FiMessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No reviews yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div key={review._id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0">
                                            {review.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{review.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-0.5 ml-auto">
                                            {renderStars(review.rating)}
                                        </div>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                                    {review.media && review.media.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {review.media.map((item, i) => (
                                                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                                                    {item.type === 'video' ? (
                                                        <video src={item.url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(review._id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                    title="Delete review"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
