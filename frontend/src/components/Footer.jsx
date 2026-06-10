"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FiMapPin, FiPhone, FiMail } from "react-icons/fi";
import {
    FaFacebookF,
    FaInstagram,
    FaLinkedinIn,
    FaYoutube,
    FaTiktok,
    FaTwitter,
    FaWhatsapp,
} from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";
import { fetchSiteSettings, fetchFooter } from "../lib/dynamicContent";
import { useWhatsApp } from "@/hooks/useWhatsApp";

// Map platform name (case-insensitive) → icon + brand color hover.
const PLATFORM_META = {
    facebook: { Icon: FaFacebookF, hoverBg: "hover:bg-[#1877F2]" },
    instagram: {
        Icon: FaInstagram,
        hoverBg:
            "hover:bg-gradient-to-tr hover:from-[#feda75] hover:via-[#fa7e1e] hover:to-[#d62976]",
    },
    linkedin: { Icon: FaLinkedinIn, hoverBg: "hover:bg-[#0A66C2]" },
    youtube: { Icon: FaYoutube, hoverBg: "hover:bg-[#FF0000]" },
    tiktok: { Icon: FaTiktok, hoverBg: "hover:bg-black" },
    twitter: { Icon: FaTwitter, hoverBg: "hover:bg-[#1DA1F2]" },
    x: { Icon: FaTwitter, hoverBg: "hover:bg-black" },
    whatsapp: { Icon: FaWhatsapp, hoverBg: "hover:bg-[#25D366]" },
    email: { Icon: HiOutlineMail, hoverBg: "hover:bg-[#EA4335]" },
};

const FALLBACK_SETTINGS = {
    siteName: "Ab9dEcommerce",
    description:
        "Ab9dEcommerce is an e-commerce platform dedicated to delivering quality and reliable products to every home.",
    logoUrl: "/logo.png",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "[Your Business Address]",
    socialLinks: [],
};

const FALLBACK_FOOTER = {
    columns: [
        {
            title: "Customer Support",
            links: [
                { label: "Corporate Deal", url: "/corporate-deal" },
                { label: "Contact", url: "/contact" },
                { label: "Refund and Returns", url: "/refund-returns" },
                { label: "FAQ", url: "/faq" },
                { label: "Blog", url: "/blog" },
            ],
        },
        {
            title: "Information",
            links: [
                { label: "About", url: "/about" },
                { label: "Terms & Conditions", url: "/terms-condition" },
                { label: "Privacy Policy", url: "/privacy-policy" },
            ],
        },
    ],
    copyrightText: "",
};

const merge = (fallback, dynamic) => {
    if (!dynamic) return fallback;
    const out = { ...fallback };
    for (const [k, v] of Object.entries(dynamic)) {
        if (v == null) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        out[k] = v;
    }
    return out;
};

export default function Footer() {
    const pathname = usePathname();
    const wa = useWhatsApp();
    const [settings, setSettings] = useState(FALLBACK_SETTINGS);
    const [footer, setFooter] = useState(FALLBACK_FOOTER);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [s, f] = await Promise.all([fetchSiteSettings(), fetchFooter()]);
            if (cancelled) return;
            if (s) setSettings(merge(FALLBACK_SETTINGS, s));
            if (f) setFooter(merge(FALLBACK_FOOTER, f));
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const socialIcons = (settings.socialLinks || []).map((link) => {
        const meta = PLATFORM_META[(link.platform || "").toLowerCase()] || {
            Icon: HiOutlineMail,
            hoverBg: "hover:bg-emerald-700",
        };
        return { ...link, ...meta };
    });

    const columns = (footer.columns?.length ? footer.columns : FALLBACK_FOOTER.columns).slice();
    columns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // The POS terminal renders full-screen without storefront chrome.
    if (pathname?.startsWith("/pos")) return null;

    return (
        <footer className="relative mt-16 text-emerald-50 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300" />

            <div className="relative bg-gradient-to-b from-[#064e3b] via-[#065f46] to-[#022c22]">
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.08] pointer-events-none"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 20% 20%, #fbbf24 0, transparent 35%), radial-gradient(circle at 80% 80%, #10b981 0, transparent 35%)",
                    }}
                />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                        {/* Left — brand block */}
                        <div className="md:col-span-5">
                            <div className="mb-4 inline-flex items-center justify-center bg-white/95 rounded-full shadow-lg ring-4 ring-amber-400 w-36 h-36 sm:w-40 sm:h-40">
                                <Image
                                    src={settings.logoUrl || "/logo.png"}
                                    alt={`${settings.siteName} Logo`}
                                    width={220}
                                    height={70}
                                    className="object-contain w-28 sm:w-32 h-auto"
                                />
                            </div>
                            <p className="text-emerald-100/90 leading-relaxed mb-6 max-w-md">
                                {settings.description || FALLBACK_SETTINGS.description}
                            </p>

                            <div className="space-y-3 mb-7 text-sm">
                                {settings.contactAddress && (
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                            <FiMapPin className="w-4 h-4" />
                                        </span>
                                        <span className="text-emerald-50">
                                            {settings.contactAddress}
                                        </span>
                                    </div>
                                )}
                                {settings.contactPhone && (
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                            <FiPhone className="w-4 h-4" />
                                        </span>
                                        <a
                                            href={`tel:${settings.contactPhone.replace(/\s/g, "")}`}
                                            className="text-emerald-50 hover:text-amber-300 transition-colors"
                                        >
                                            {settings.contactPhone}
                                        </a>
                                    </div>
                                )}
                                {settings.contactEmail && (
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                            <FiMail className="w-4 h-4" />
                                        </span>
                                        <a
                                            href={`mailto:${settings.contactEmail}`}
                                            className="text-emerald-50 hover:text-amber-300 transition-colors"
                                        >
                                            {settings.contactEmail}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {socialIcons.length > 0 && (
                                <div className="flex flex-wrap gap-2.5">
                                    {socialIcons.map(({ platform, url, Icon, hoverBg }) => (
                                        <a
                                            key={platform + url}
                                            href={url}
                                            aria-label={platform}
                                            title={platform}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-emerald-50 ring-1 ring-white/15 ${hoverBg} hover:text-white hover:ring-white/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
                                        >
                                            <Icon className="w-[18px] h-[18px]" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Middle/right — dynamic columns */}
                        {columns.slice(0, 2).map((col, idx) => (
                            <div key={col.title + idx} className={idx === 0 ? "md:col-span-3" : "md:col-span-4"}>
                                <h3 className="text-base font-bold text-white mb-4 relative inline-block">
                                    {col.title}
                                    <span className="absolute -bottom-1.5 left-0 w-10 h-0.5 bg-amber-400 rounded-full" />
                                </h3>
                                <ul className="space-y-2.5 text-sm mb-7">
                                    {(col.links || [])
                                        .slice()
                                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                        .map((l, j) => (
                                            <li key={l.label + l.url + j}>
                                                {l.openInNewTab ? (
                                                    <a
                                                        href={l.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group inline-flex items-center text-emerald-100/90 hover:text-amber-300 transition-colors"
                                                    >
                                                        <span className="inline-block w-0 group-hover:w-3 h-px bg-amber-400 mr-0 group-hover:mr-2 transition-all duration-300" />
                                                        {l.label}
                                                    </a>
                                                ) : (
                                                    <Link
                                                        href={l.url}
                                                        className="group inline-flex items-center text-emerald-100/90 hover:text-amber-300 transition-colors"
                                                    >
                                                        <span className="inline-block w-0 group-hover:w-3 h-px bg-amber-400 mr-0 group-hover:mr-2 transition-all duration-300" />
                                                        {l.label}
                                                    </Link>
                                                )}
                                            </li>
                                        ))}
                                </ul>

                                {idx === 1 && (settings.contactPhone || wa.enabled) && (
                                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 ring-1 ring-white/10">
                                        <p className="text-xs font-semibold tracking-widest uppercase text-amber-300 mb-1">
                                            Need help with an order?
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {settings.contactPhone && (
                                                <a
                                                    href={`tel:${settings.contactPhone.replace(/\s/g, "")}`}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                                                >
                                                    <FiPhone className="w-4 h-4" />
                                                    Call to Order
                                                </a>
                                            )}
                                            {wa.enabled && (
                                                <a
                                                    href={wa.chatUrl("Hi, I'd like to place an order.")}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                                                >
                                                    <FaWhatsapp className="w-4 h-4" />
                                                    Chat on WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-emerald-100/80">
                        <p>
                            {footer.copyrightText ||
                                `© ${new Date().getFullYear()} ${settings.siteName}. All rights reserved.`}
                        </p>
                        <p className="font-medium">
                            Crafted with care · <span className="text-amber-300">Developed by Abdullah AL Fuad</span>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
