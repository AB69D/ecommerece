"use client";
import Link from "next/link";
import Image from "next/image";
import { FiMapPin, FiPhone, FiMail } from "react-icons/fi";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube, FaTiktok } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";

const socialLinks = [
    {
        href: "https://www.facebook.com/share/1GcHsDrdfT/",
        label: "Facebook",
        Icon: FaFacebookF,
        hoverBg: "hover:bg-[#1877F2]",
    },
    {
        href: "https://www.instagram.com/gram2ghor?igsh=cTNsdmJ1dWd1azZu",
        label: "Instagram",
        Icon: FaInstagram,
        hoverBg: "hover:bg-gradient-to-tr hover:from-[#feda75] hover:via-[#fa7e1e] hover:to-[#d62976]",
    },
    {
        href: "https://www.linkedin.com/in/gram-2-ghor-a5a15a402",
        label: "LinkedIn",
        Icon: FaLinkedinIn,
        hoverBg: "hover:bg-[#0A66C2]",
    },
    {
        href: "mailto:gram2ghor@gmail.com",
        label: "Email",
        Icon: HiOutlineMail,
        hoverBg: "hover:bg-[#EA4335]",
        external: false,
    },
    {
        href: "https://youtube.com/@gram2ghor?si=iKdccWgOOUNrarJs",
        label: "YouTube",
        Icon: FaYoutube,
        hoverBg: "hover:bg-[#FF0000]",
    },
    {
        href: "https://www.tiktok.com/@gram2.ghor?_r=1&_t=ZS-95OXC3fLIaD",
        label: "TikTok",
        Icon: FaTiktok,
        hoverBg: "hover:bg-black",
    },
];

export default function Footer() {
    return (
        <footer className="relative mt-16 text-emerald-50 overflow-hidden">
            {/* Decorative gold accent strip */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300" />

            {/* Deep emerald gradient background with subtle radial glow */}
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
                                    src="/logo.png"
                                    alt="Gram2Ghor Logo"
                                    width={220}
                                    height={70}
                                    className="object-contain w-28 sm:w-32 h-auto"
                                />
                            </div>
                            <p className="text-emerald-100/90 leading-relaxed mb-6 max-w-md">
                                Gram2ghor is an e-commerce platform dedicated to delivering safe,
                                organic and reliable food from the village to every home.
                            </p>

                            <div className="space-y-3 mb-7 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                        <FiMapPin className="w-4 h-4" />
                                    </span>
                                    <span className="text-emerald-50">14/D, Kaderabad Housing, Mohammadpur, Dhaka</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                        <FiPhone className="w-4 h-4" />
                                    </span>
                                    <span className="text-emerald-50">
                                        <a href="tel:+8801822858380" className="hover:text-amber-300 transition-colors">01822858380</a>
                                        <span className="mx-2 text-emerald-300/60">·</span>
                                        <a href="tel:+8801822858283" className="hover:text-amber-300 transition-colors">01822858283</a>
                                    </span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center ring-1 ring-amber-300/30">
                                        <FiMail className="w-4 h-4" />
                                    </span>
                                    <a href="mailto:gram2ghor@gmail.com" className="text-emerald-50 hover:text-amber-300 transition-colors">
                                        gram2ghor@gmail.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                {socialLinks.map(({ href, label, Icon, hoverBg, external = true }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        aria-label={label}
                                        title={label}
                                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                        className={`w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-emerald-50 ring-1 ring-white/15 ${hoverBg} hover:text-white hover:ring-white/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
                                    >
                                        <Icon className="w-[18px] h-[18px]" />
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Middle — customer support */}
                        <div className="md:col-span-3">
                            <h3 className="text-base font-bold text-white mb-4 relative inline-block">
                                Customer Support
                                <span className="absolute -bottom-1.5 left-0 w-10 h-0.5 bg-amber-400 rounded-full" />
                            </h3>
                            <ul className="space-y-2.5 text-sm">
                                {[
                                    { href: "/corporate-deal", label: "Corporate Deal" },
                                    { href: "/contact", label: "Contact" },
                                    { href: "/refund-returns", label: "Refund and Returns" },
                                    { href: "/faq", label: "FAQ" },
                                    { href: "/blog", label: "Blog" },
                                ].map((l) => (
                                    <li key={l.href}>
                                        <Link
                                            href={l.href}
                                            className="group inline-flex items-center text-emerald-100/90 hover:text-amber-300 transition-colors"
                                        >
                                            <span className="inline-block w-0 group-hover:w-3 h-px bg-amber-400 mr-0 group-hover:mr-2 transition-all duration-300" />
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Right — information */}
                        <div className="md:col-span-4">
                            <h3 className="text-base font-bold text-white mb-4 relative inline-block">
                                Information
                                <span className="absolute -bottom-1.5 left-0 w-10 h-0.5 bg-amber-400 rounded-full" />
                            </h3>
                            <ul className="space-y-2.5 text-sm mb-7">
                                {[
                                    { href: "/about", label: "About" },
                                    { href: "/terms-condition", label: "Terms & Conditions" },
                                    { href: "/privacy-policy", label: "Privacy Policy" },
                                ].map((l) => (
                                    <li key={l.href}>
                                        <Link
                                            href={l.href}
                                            className="group inline-flex items-center text-emerald-100/90 hover:text-amber-300 transition-colors"
                                        >
                                            <span className="inline-block w-0 group-hover:w-3 h-px bg-amber-400 mr-0 group-hover:mr-2 transition-all duration-300" />
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 ring-1 ring-white/10">
                                <p className="text-xs font-semibold tracking-widest uppercase text-amber-300 mb-1">
                                    Need help with an order?
                                </p>
                                <a
                                    href="tel:+8801822858380"
                                    className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                                >
                                    <FiPhone className="w-4 h-4" />
                                    Call to Order
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-emerald-100/80">
                        <p>&copy; {new Date().getFullYear()} Gram2ghor. All rights reserved.</p>
                        <p className="font-medium">
                            Crafted with care · <span className="text-amber-300">Developed by Abdullah AL Fuad</span>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
