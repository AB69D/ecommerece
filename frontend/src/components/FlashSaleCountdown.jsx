"use client";
import { useState, useEffect } from "react";

// Client-side countdown to a flash sale's end time.
// Renders HH:MM:SS. When the sale expires it shows "Sale ended".
// Must be rendered inside a 'use client' boundary (this file already is one).
export default function FlashSaleCountdown({ endsAt, className = "" }) {
    const calc = () => {
        const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
        return {
            h: Math.floor(diff / 3_600_000),
            m: Math.floor((diff % 3_600_000) / 60_000),
            s: Math.floor((diff % 60_000) / 1_000),
            expired: diff === 0,
        };
    };

    const [t, setT] = useState(calc);

    useEffect(() => {
        if (t.expired) return;
        const id = setInterval(() => setT(calc()), 1_000);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endsAt, t.expired]);

    if (t.expired) {
        return <span className={className}>Sale ended</span>;
    }

    const pad = (n) => String(n).padStart(2, "0");

    return (
        <span className={className}>
            {t.h > 0 && `${pad(t.h)}:`}{pad(t.m)}:{pad(t.s)}
        </span>
    );
}
