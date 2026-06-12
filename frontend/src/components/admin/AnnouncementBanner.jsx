"use client";
import { useEffect, useState } from "react";
import { FiInfo, FiAlertTriangle, FiAlertCircle, FiX } from "react-icons/fi";
import { getMyAnnouncements } from "@/services/announcements";

const LEVEL = {
    info: { wrap: "bg-indigo-50 border-indigo-200 text-indigo-900", icon: <FiInfo className="w-4 h-4 text-indigo-500" /> },
    warning: { wrap: "bg-amber-50 border-amber-200 text-amber-900", icon: <FiAlertTriangle className="w-4 h-4 text-amber-500" /> },
    critical: { wrap: "bg-red-50 border-red-300 text-red-900", icon: <FiAlertCircle className="w-4 h-4 text-red-500" /> },
};

const KEY = "dismissed_announcements";
const readDismissed = () => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

// Active platform notices for this store, shown at the top of the admin. Dismiss
// is remembered per browser (by id) so a closed notice stays closed, while a new
// notice still appears.
export default function AnnouncementBanner() {
    const [items, setItems] = useState([]);
    const [dismissed, setDismissed] = useState([]);

    useEffect(() => {
        setDismissed(readDismissed());
        let alive = true;
        getMyAnnouncements()
            .then((res) => { if (alive && res?.success) setItems(res.data?.announcements || []); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    const dismiss = (id) => {
        const next = [...new Set([...dismissed, id])];
        setDismissed(next);
        try { localStorage.setItem(KEY, JSON.stringify(next.slice(-200))); } catch { /* ignore */ }
    };

    const visible = items.filter((a) => !dismissed.includes(a.id));
    if (visible.length === 0) return null;

    return (
        <div className="max-w-6xl mx-auto mb-4 space-y-2">
            {visible.map((a) => {
                const lvl = LEVEL[a.level] || LEVEL.info;
                return (
                    <div key={a.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${lvl.wrap}`}>
                        <span className="mt-0.5 shrink-0">{lvl.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{a.title}</p>
                            <p className="text-sm opacity-90 whitespace-pre-wrap">{a.body}</p>
                        </div>
                        <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="shrink-0 p-1 rounded-md hover:bg-black/5">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
