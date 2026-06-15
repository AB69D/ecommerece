"use client";
import { authFetch } from "@/services/api";
import { useState, useEffect } from "react";
import { FiStar, FiTrash2, FiMessageSquare, FiCheck, FiX } from "react-icons/fi";
import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";
import { useFeature } from "@/hooks/useSiteSettings";

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
    const [filter, setFilter] = useState("all"); // "all" | "pending" | "approved"
    const moderationOn = useFeature("reviewModeration", false);

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
            const res = await authFetch(`/api/admin/review/delete/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) setReviews((prev) => prev.filter((r) => r._id !== id));
            else alert(data.message || "Failed to delete");
        } catch { alert("Failed to delete review"); }
    };

    const handleApprove = async (id) => {
        try {
            const res = await authFetch(`/api/admin/review/approve/${id}`, { method: "PATCH" });
            const data = await res.json();
            if (data.success) setReviews((prev) => prev.map((r) => r._id === id ? { ...r, approved: true } : r));
        } catch { alert("Failed to approve review"); }
    };

    const handleReject = async (id) => {
        try {
            const res = await authFetch(`/api/admin/review/reject/${id}`, { method: "PATCH" });
            const data = await res.json();
            if (data.success) setReviews((prev) => prev.map((r) => r._id === id ? { ...r, approved: false } : r));
        } catch { alert("Failed to reject review"); }
    };

    const filtered = reviews.filter((r) => {
        if (filter === "pending") return r.approved === false;
        if (filter === "approved") return r.approved !== false;
        return true;
    });

    const pendingCount = reviews.filter((r) => r.approved === false).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-2xl font-bold text-gray-800">Customer Reviews</h3>
                    <p className="text-gray-500 mt-1">
                        {reviews.length} total{pendingCount > 0 && moderationOn ? ` · ${pendingCount} pending approval` : ""}
                    </p>
                </div>
                {moderationOn && (
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        {[["all", "All"], ["pending", "Pending"], ["approved", "Approved"]].map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setFilter(val)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === val ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                {label}
                                {val === "pending" && pendingCount > 0 && (
                                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-white text-xs rounded-full">{pendingCount}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <FiMessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">{filter === "pending" ? "No pending reviews" : "No reviews yet"}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((review) => (
                        <div key={review._id} className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow ${review.approved === false ? "border-amber-200 bg-amber-50/30" : "border-gray-200"}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0">
                                            {review.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{review.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(review.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            {renderStars(review.rating)}
                                        </div>
                                        {moderationOn && (
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${review.approved === false ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                {review.approved === false ? "Pending" : "Approved"}
                                            </span>
                                        )}
                                    </div>
                                    {review.product ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full mb-2">
                                            {`${review.product.firstName || ""} ${review.product.lastName || ""}`.trim() || "Product"}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mb-2">
                                            General review
                                        </span>
                                    )}
                                    <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                                    {review.media && review.media.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {review.media.map((item, i) => (
                                                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                                                    {item.type === "video" ? (
                                                        <video src={item.url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {moderationOn && review.approved === false && (
                                        <button
                                            onClick={() => handleApprove(review._id)}
                                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Approve review"
                                        >
                                            <FiCheck className="w-4 h-4" />
                                        </button>
                                    )}
                                    {moderationOn && review.approved !== false && (
                                        <button
                                            onClick={() => handleReject(review._id)}
                                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            title="Unpublish review"
                                        >
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(review._id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete review"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
