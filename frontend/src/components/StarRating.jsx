import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";

// Presentational 5-star display. `value` is a 0–5 number (halves supported).
const SIZES = { xs: "w-2.5 h-2.5", sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5 h-5" };

export default function StarRating({ value = 0, size = "md", className = "" }) {
    const cls = SIZES[size] || SIZES.md;
    const safe = Math.max(0, Math.min(5, Number(value) || 0));
    const full = Math.floor(safe);
    const half = safe - full >= 0.5;

    const stars = [];
    for (let i = 0; i < 5; i++) {
        if (i < full) {
            stars.push(<FaStar key={i} className={`text-yellow-400 ${cls}`} />);
        } else if (i === full && half) {
            stars.push(<FaStarHalfAlt key={i} className={`text-yellow-400 ${cls}`} />);
        } else {
            stars.push(<FaRegStar key={i} className={`text-gray-300 ${cls}`} />);
        }
    }

    return <span className={`inline-flex items-center gap-0.5 ${className}`}>{stars}</span>;
}
