"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    FiSearch,
    FiShoppingCart,
    FiTruck,
    FiMenu,
    FiX,
    FiHome,
    FiGrid,
    FiInfo,
    FiPhone,
    FiChevronRight,
} from "react-icons/fi";
import { GiHoneypot, GiOlive } from "react-icons/gi";

function Navbar() {
    const [categories, setCategories] = useState([]);
    const [cartCount, setCartCount] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isHydrated, setIsHydrated] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch(`/api/client/category/get-all-category`);
            const data = await res.json();
            if (data.success) {
                setCategories(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
        }
    }, []);

    const getGuestId = useCallback(() => {
        if (typeof window === "undefined") return null;
        let guestId = localStorage.getItem("guestId");
        if (!guestId) {
            guestId = `guest_${Date.now()}`;
            localStorage.setItem("guestId", guestId);
        }
        return guestId;
    }, []);

    const fetchCartCount = useCallback(async () => {
        try {
            const guestId = getGuestId();
            const res = await fetch(`/api/client/cart/get`, {
                headers: { "guest-id": guestId },
            });
            const data = await res.json();
            if (data.success && data.data) {
                setCartCount(data.data.items?.length || 0);
            }
        } catch (error) {
            console.error("Failed to fetch cart count", error);
        }
    }, [getGuestId]);

    useEffect(() => {
        fetchCategories();
        fetchCartCount();

        const handleCartUpdate = () => fetchCartCount();
        window.addEventListener("cart-updated", handleCartUpdate);
        return () => window.removeEventListener("cart-updated", handleCartUpdate);
    }, [fetchCategories, fetchCartCount]);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mobileMenuOpen]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery("");
            setMobileMenuOpen(false);
        }
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    const desktopNavLinks = [
        { href: "/", label: "Home" },
        { href: "/ghee-oil-new", label: "Ghee & Oil" },
        { href: "/honey-sweets-new", label: "Honey & Sweets" },
    ];

    const mobilePrimaryLinks = [
        { href: "/", label: "Home", Icon: FiHome },
        { href: "/ghee-oil-new", label: "Ghee & Oil", Icon: GiOlive },
        { href: "/honey-sweets-new", label: "Honey & Sweets", Icon: GiHoneypot },
        { href: "/track-order", label: "Track Order", Icon: FiTruck },
    ];

    const mobileSecondaryLinks = [
        { href: "/about", label: "About Us", Icon: FiInfo },
        { href: "/contact", label: "Contact", Icon: FiPhone },
    ];

    return (
        <>
            <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-16 sm:h-20">
                        {/* LEFT ZONE — equal flex so the centre logo is mathematically centred */}
                        <div className="flex-1 flex items-center justify-start min-w-0">
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="md:hidden p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                aria-label="Open menu"
                            >
                                <FiMenu className="w-6 h-6" />
                            </button>

                            <div className="hidden md:flex space-x-5 lg:space-x-7 items-center">
                                {desktopNavLinks.map((l) => (
                                    <Link
                                        key={l.href}
                                        href={l.href}
                                        className="relative text-gray-700 hover:text-emerald-700 font-medium transition-colors group"
                                    >
                                        {l.label}
                                        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-amber-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                                    </Link>
                                ))}

                                <div className="relative group">
                                    <button className="flex items-center text-gray-700 hover:text-emerald-700 font-medium transition-colors py-2 focus:outline-none">
                                        All Categories
                                        <svg
                                            className="ml-1 w-4 h-4 transition-transform group-hover:rotate-180"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <div className="absolute left-0 mt-0 w-52 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 overflow-hidden">
                                        <div className="h-1 bg-gradient-to-r from-emerald-500 to-amber-400" />
                                        <div className="py-2">
                                            {categories.length > 0 ? (
                                                categories.map((category) => (
                                                    <Link
                                                        key={category._id}
                                                        href={`/${encodeURIComponent(category.category_name.toLowerCase().replace(/\s+/g, "-"))}`}
                                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2" />
                                                        {category.category_name}
                                                    </Link>
                                                ))
                                            ) : (
                                                <span className="block px-4 py-2 text-sm text-gray-500">No categories found</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Link
                                    href="/track-order"
                                    className="flex items-center gap-1 text-gray-700 hover:text-emerald-700 font-medium transition-colors"
                                >
                                    <FiTruck className="w-4 h-4" />
                                    Track Order
                                </Link>
                            </div>
                        </div>

                        {/* CENTER ZONE — logo, sits in the visual centre on every breakpoint */}
                        <div className="flex-shrink-0 px-3 sm:px-4">
                            <Link href="/" className="flex items-center" aria-label="Gram2Ghor home">
                                <div className="w-28 sm:w-[150px] lg:w-48">
                                    <Image
                                        src="/logo.png"
                                        alt="Gram2Ghor Logo"
                                        width={240}
                                        height={60}
                                        className="object-contain w-full h-auto"
                                        priority
                                    />
                                </div>
                            </Link>
                        </div>

                        {/* RIGHT ZONE — equal flex, content pushed to the end */}
                        <div className="flex-1 flex items-center justify-end space-x-1.5 sm:space-x-3 min-w-0">
                            <button
                                onClick={() => isHydrated && setMobileMenuOpen(true)}
                                className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                aria-label="Search"
                            >
                                <FiSearch className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>

                            <Link href="/cart" className="relative" aria-label="Cart">
                                <button
                                    className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                    aria-label="Cart"
                                >
                                    <FiShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                                {cartCount > 0 && (
                                    <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] px-1 text-[10px] sm:text-xs font-bold leading-none text-emerald-950 transform translate-x-1/4 -translate-y-1/4 bg-amber-400 rounded-full border-2 border-white shadow-sm">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* MOBILE DRAWER — premium emerald-gold redesign */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-[60] md:hidden"
                    onClick={closeMobileMenu}
                    aria-hidden
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                </div>
            )}

            <aside
                className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-[70] md:hidden transform transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] shadow-2xl ${
                    mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
                aria-hidden={!mobileMenuOpen}
            >
                <div className="flex flex-col h-full">
                    {/* Drawer header — deep emerald gradient + gold strip */}
                    <div className="relative overflow-hidden">
                        <div className="h-1.5 w-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300" />
                        <div className="relative bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857] p-5">
                            <div
                                aria-hidden
                                className="absolute inset-0 opacity-[0.10] pointer-events-none"
                                style={{
                                    backgroundImage:
                                        "radial-gradient(circle at 0% 0%, #fbbf24 0, transparent 35%), radial-gradient(circle at 100% 100%, #10b981 0, transparent 40%)",
                                }}
                            />
                            <div className="relative flex items-center justify-between">
                                <Link
                                    href="/"
                                    onClick={closeMobileMenu}
                                    className="inline-block bg-white rounded-xl px-3 py-2 shadow-md"
                                >
                                    <div className="w-[110px]">
                                        <Image
                                            src="/logo.png"
                                            alt="Gram2Ghor Logo"
                                            width={220}
                                            height={70}
                                            className="object-contain w-full h-auto"
                                        />
                                    </div>
                                </Link>
                                <button
                                    onClick={closeMobileMenu}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-emerald-50 ring-1 ring-white/20 hover:bg-amber-400 hover:text-emerald-950 hover:ring-amber-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    aria-label="Close menu"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="relative mt-4 text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">
                                Pure · Organic · Trusted
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/60">
                        <form onSubmit={handleSearch} className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-sm"
                            />
                            <button
                                type="submit"
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-emerald-600"
                                aria-label="Search"
                            >
                                <FiSearch className="w-5 h-5" />
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto hide-scrollbar">
                        {/* Primary links — premium icon badges */}
                        <nav className="py-2">
                            {mobilePrimaryLinks.map(({ href, label, Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={closeMobileMenu}
                                    className="group flex items-center gap-3 px-4 py-3 text-gray-800 hover:bg-emerald-50/60 transition-colors border-b border-gray-50"
                                >
                                    <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-700 ring-1 ring-emerald-100 group-hover:from-emerald-600 group-hover:to-emerald-700 group-hover:text-white group-hover:ring-emerald-600 group-hover:shadow-md group-hover:shadow-emerald-200/60 transition-all duration-200">
                                        <Icon className="w-[18px] h-[18px]" />
                                    </span>
                                    <span className="flex-1 font-medium text-[15px]">{label}</span>
                                    <FiChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                                </Link>
                            ))}
                        </nav>

                        {/* Categories accordion */}
                        <div className="px-4 pt-4">
                            <button
                                onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}
                                className="flex items-center justify-between w-full text-left rounded-xl bg-gradient-to-r from-emerald-50 to-amber-50 px-4 py-3 ring-1 ring-emerald-100/70 hover:ring-emerald-200 transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-100 shadow-sm">
                                        <FiGrid className="w-4 h-4" />
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800 tracking-wide">
                                        All Categories
                                    </span>
                                </span>
                                <svg
                                    className={`w-5 h-5 text-emerald-700 transition-transform duration-200 ${mobileCategoriesOpen ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div
                                className={`overflow-hidden transition-all duration-300 ${mobileCategoriesOpen ? "max-h-[500px] mt-2" : "max-h-0"}`}
                            >
                                <div className="py-1">
                                    {categories.length > 0 ? (
                                        categories.map((category) => (
                                            <Link
                                                key={category._id}
                                                href={`/${encodeURIComponent(category.category_name.toLowerCase().replace(/\s+/g, "-"))}`}
                                                onClick={closeMobileMenu}
                                                className="group flex items-center px-3 py-2.5 text-gray-700 hover:text-emerald-700 transition-colors rounded-lg hover:bg-emerald-50/60"
                                            >
                                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mr-3 group-hover:scale-150 transition-transform" />
                                                <span className="text-sm">{category.category_name}</span>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-sm text-gray-500">No categories found</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Secondary links */}
                        <nav className="mt-4 px-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-2">
                                More
                            </p>
                            <div className="bg-white rounded-xl ring-1 ring-gray-100 overflow-hidden">
                                {mobileSecondaryLinks.map(({ href, label, Icon }, i) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={closeMobileMenu}
                                        className={`flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700 transition-colors ${i !== 0 ? "border-t border-gray-50" : ""}`}
                                    >
                                        <Icon className="w-4 h-4 text-emerald-600" />
                                        <span className="text-sm font-medium">{label}</span>
                                    </Link>
                                ))}
                            </div>
                        </nav>
                    </div>

                    {/* Footer CTA inside drawer */}
                    <div className="p-4 border-t border-gray-100 bg-gradient-to-br from-[#064e3b] to-[#022c22] text-emerald-50">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300 font-semibold mb-2">
                            Need help?
                        </p>
                        <a
                            href="tel:+8801822858380"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <FiPhone className="w-4 h-4" />
                            Call to Order
                        </a>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Navbar;
