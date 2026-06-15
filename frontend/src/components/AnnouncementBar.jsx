"use client";
import { usePathname } from "next/navigation";

export default function AnnouncementBar({ announcement }) {
    const pathname = usePathname();
    if (pathname?.startsWith("/pos")) return null;
    if (!announcement?.enabled || !announcement?.message) return null;

    const bar = (
        <div
            className="w-full text-center text-sm px-4 py-2 font-medium"
            style={{
                backgroundColor: announcement.bgColor || "#1e40af",
                color: announcement.textColor || "#ffffff",
            }}
        >
            {announcement.message}
        </div>
    );

    if (announcement.link) {
        return (
            <a href={announcement.link} className="block hover:opacity-90 transition-opacity">
                {bar}
            </a>
        );
    }
    return bar;
}
