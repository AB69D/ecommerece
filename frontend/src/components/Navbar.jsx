"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    FiSearch,
    FiShoppingCart,
    FiHeart,
    FiTruck,
    FiMenu,
    FiX,
    FiHome,
    FiGrid,
    FiInfo,
    FiPhone,
    FiChevronRight,
    FiUser,
    FiPackage,
    FiMapPin,
    FiLogOut,
} from "react-icons/fi";
import { getWishlist, setWishlistEnabled } from "@/services/wishlist";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import SearchAutocomplete from "./SearchAutocomplete";

function Navbar() {
    const [categories, setCategories] = useState([]);
    const [branding, setBranding] = useState({ siteName: "Ab9dEcommerce", logoUrl: "" });
    // `brandingLoaded` flips true once site-settings resolve, so we never paint the
    // bundled fallback logo and then swap it for the admin one (the wrong-logo flash).
    // `logoReady` flips true once the actual <Image> has decoded — until then the
    // navbar shows a skeleton instead of a stand-in logo.
    const [brandingLoaded, setBrandingLoaded] = useState(false);
    const [logoReady, setLogoReady] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [wishlistCount, setWishlistCount] = useState(0);
    const [wishlistOn, setWishlistOn] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
    // Universal search overlay (the header search icon opens this on every
    // screen size — the mobile drawer is hidden on desktop).
    const [searchOpen, setSearchOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { customer, logout } = useCustomerAuth();

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

    const fetchWishlistCount = useCallback(async () => {
        try {
            const data = await getWishlist();
            if (data?.success && data.data) {
                setWishlistCount(data.data.items?.length || 0);
            }
        } catch (error) {
            console.error("Failed to fetch wishlist count", error);
        }
    }, []);

    useEffect(() => {
        (async () => {
            await fetchCategories();
            await fetchCartCount();
            await fetchWishlistCount();
            try {
                const res = await fetch(`/api/client/site-settings`);
                const data = await res.json();
                if (data?.success && data.data) {
                    setBranding({
                        siteName: data.data.siteName || "Ab9dEcommerce",
                        logoUrl: data.data.logoUrl || "",
                    });
                    // Mirror the wishlist feature flag so every product card's
                    // heart can respect the admin toggle without re-fetching.
                    const on = data.data.features?.wishlist !== false;
                    setWishlistOn(on);
                    setWishlistEnabled(on);
                }
            } catch { /* keep defaults */ } finally {
                // Branding settled (admin logo or bundled default) — let the navbar
                // render the real logo over its skeleton, never a wrong-logo flash.
                setBrandingLoaded(true);
            }
        })();

        const handleCartUpdate = () => fetchCartCount();
        const handleWishlistUpdate = () => fetchWishlistCount();
        window.addEventListener("cart-updated", handleCartUpdate);
        window.addEventListener("wishlist-updated", handleWishlistUpdate);
        return () => {
            window.removeEventListener("cart-updated", handleCartUpdate);
            window.removeEventListener("wishlist-updated", handleWishlistUpdate);
        };
    }, [fetchCategories, fetchCartCount, fetchWishlistCount]);

    useEffect(() => {
        const lock = mobileMenuOpen || searchOpen;
        document.body.style.overflow = lock ? "hidden" : "unset";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mobileMenuOpen, searchOpen]);

    // Close the search overlay on Escape.
    useEffect(() => {
        if (!searchOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") setSearchOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [searchOpen]);

    // The POS terminal renders full-screen without storefront chrome.
    if (pathname?.startsWith("/pos")) return null;

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    const desktopNavLinks = [
        { href: "/", label: "Home" },
    ];

    const mobilePrimaryLinks = [
        { href: "/", label: "Home", Icon: FiHome },
        { href: "/track-order", label: "Track Order", Icon: FiTruck },
    ];

    const mobileSecondaryLinks = [
        { href: "/about", label: "About Us", Icon: FiInfo },
        { href: "/contact", label: "Contact", Icon: FiPhone },
    ];

    return (
        <>
            <nav
                className="sticky top-0 z-50 shadow-md border-b border-white/10 text-[color:var(--theme-nav-text)]"
                style={{ backgroundImage: "linear-gradient(to right, var(--theme-nav-from), var(--theme-nav-via), var(--theme-nav-to))" }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-16 sm:h-20">
                        {/* LEFT ZONE — equal flex so the centre logo is mathematically centred */}
                        <div className="flex-1 flex items-center justify-start min-w-0">
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="md:hidden p-2 opacity-90 hover:opacity-100 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
                                aria-label="Open menu"
                            >
                                <FiMenu className="w-6 h-6" />
                            </button>

                            <div className="hidden md:flex space-x-5 lg:space-x-7 items-center">
                                {desktopNavLinks.map((l) => (
                                    <Link
                                        key={l.href}
                                        href={l.href}
                                        className="relative font-medium opacity-90 hover:opacity-100 transition-opacity group"
                                    >
                                        {l.label}
                                        <span
                                            className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"
                                            style={{ backgroundColor: "var(--theme-accent)" }}
                                        />
                                    </Link>
                                ))}

                                <div className="relative group">
                                    <button className="flex items-center font-medium opacity-90 hover:opacity-100 transition-opacity py-2 focus:outline-none">
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
                                        <div className="h-1" style={{ background: "linear-gradient(to right, var(--theme-primary), var(--theme-accent))" }} />
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
                                    className="flex items-center gap-1 font-medium opacity-90 hover:opacity-100 transition-opacity"
                                >
                                    <FiTruck className="w-4 h-4" />
                                    Track Order
                                </Link>
                            </div>
                        </div>

                        {/* CENTER ZONE — logo sits directly on the gradient (no white box);
                            a skeleton holds the space until the real logo has decoded. */}
                        <div className="flex-shrink-0 px-2 sm:px-4">
                            <Link href="/" className="flex items-center" aria-label={`${branding.siteName} home`}>
                                <div className="relative h-9 w-28 sm:h-11 sm:w-40 lg:h-12 lg:w-48">
                                    {(!brandingLoaded || !logoReady) && (
                                        <div className="absolute inset-0 rounded-lg bg-white/20 animate-pulse" />
                                    )}
                                    {brandingLoaded && (
                                        <Image
                                            key={branding.logoUrl || "default"}
                                            src={branding.logoUrl || "/logo.png"}
                                            alt={`${branding.siteName} Logo`}
                                            fill
                                            sizes="(max-width: 640px) 112px, (max-width: 1024px) 160px, 192px"
                                            className={`object-contain object-center transition-opacity duration-300 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.25))] ${logoReady ? "opacity-100" : "opacity-0"}`}
                                            priority
                                            unoptimized={!!branding.logoUrl}
                                            onLoad={() => setLogoReady(true)}
                                            onError={() => setLogoReady(true)}
                                        />
                                    )}
                                </div>
                            </Link>
                        </div>

                        {/* RIGHT ZONE — equal flex, content pushed to the end */}
                        <div className="flex-1 flex items-center justify-end space-x-1.5 sm:space-x-3 min-w-0">
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="p-2 opacity-90 hover:opacity-100 hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
                                aria-label="Search"
                            >
                                <FiSearch className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>

                            {/* Account — desktop hover menu (small screens use the
                                drawer's account block instead). */}
                            <div className="relative group hidden md:block">
                                <button
                                    onClick={() => router.push(customer ? "/account" : "/account/login")}
                                    className="p-2 opacity-90 hover:opacity-100 hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
                                    aria-label="Account"
                                >
                                    <FiUser className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                                <div className="absolute right-0 mt-0 w-60 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 overflow-hidden">
                                    <div className="h-1" style={{ background: "linear-gradient(to right, var(--theme-primary), var(--theme-accent))" }} />
                                    {customer ? (
                                        <div className="py-1">
                                            <div className="px-4 py-3 border-b border-gray-50">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{customer.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                                            </div>
                                            <Link href="/account" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                                <FiUser className="w-4 h-4" /> My Account
                                            </Link>
                                            <Link href="/account/orders" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                                <FiPackage className="w-4 h-4" /> My Orders
                                            </Link>
                                            <Link href="/account/addresses" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                                <FiMapPin className="w-4 h-4" /> Addresses
                                            </Link>
                                            <button
                                                onClick={() => { logout(); router.push("/"); }}
                                                className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-gray-50"
                                            >
                                                <FiLogOut className="w-4 h-4" /> Sign out
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-1">
                                            <Link href="/account/login" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                                <FiUser className="w-4 h-4" /> Sign in
                                            </Link>
                                            <Link href="/account/register" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                                <FiChevronRight className="w-4 h-4" /> Create account
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {wishlistOn && (
                                <Link href="/wishlist" className="relative" aria-label="Wishlist">
                                    <button
                                        className="p-2 opacity-90 hover:opacity-100 hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
                                        aria-label="Wishlist"
                                    >
                                        <FiHeart className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                    {wishlistCount > 0 && (
                                        <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] px-1 text-[10px] sm:text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-rose-500 rounded-full border-2 border-white shadow-sm">
                                            {wishlistCount}
                                        </span>
                                    )}
                                </Link>
                            )}

                            <Link href="/cart" className="relative" aria-label="Cart">
                                <button
                                    className="p-2 opacity-90 hover:opacity-100 hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
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

            {/* Universal search overlay — opened by the header search icon on
                every screen size (the drawer below is mobile-only). */}
            {searchOpen && (
                <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Search products">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setSearchOpen(false)}
                    />
                    <div className="relative mx-auto mt-20 sm:mt-24 w-full max-w-2xl px-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold text-gray-700">Search products</span>
                                <button
                                    onClick={() => setSearchOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    aria-label="Close search"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                            <SearchAutocomplete autoFocus onNavigate={() => setSearchOpen(false)} />
                        </div>
                    </div>
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
                        <div className="h-1.5 w-full" style={{ backgroundColor: "var(--theme-accent)" }} />
                        <div
                            className="relative p-5"
                            style={{ backgroundImage: "linear-gradient(to bottom right, var(--theme-nav-from), var(--theme-nav-via), var(--theme-nav-to))" }}
                        >
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
                                            src={branding.logoUrl || "/logo.png"}
                                            alt={`${branding.siteName} Logo`}
                                            width={220}
                                            height={70}
                                            className="object-contain w-full h-auto"
                                            unoptimized={!!branding.logoUrl}
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
                                Pure · quality · Trusted
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/60">
                        <SearchAutocomplete onNavigate={closeMobileMenu} />
                    </div>

                    <div className="flex-1 overflow-y-auto hide-scrollbar">
                        {/* Account block */}
                        <div className="p-4 border-b border-gray-100">
                            {customer ? (
                                <div className="rounded-xl ring-1 ring-emerald-100 overflow-hidden">
                                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-50 to-amber-50">
                                        <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white">
                                            <FiUser className="w-5 h-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{customer.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white">
                                        <Link href="/account" onClick={closeMobileMenu} className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700 transition-colors border-t border-gray-50">
                                            <FiUser className="w-4 h-4 text-emerald-600" /> My Account
                                        </Link>
                                        <Link href="/account/orders" onClick={closeMobileMenu} className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700 transition-colors border-t border-gray-50">
                                            <FiPackage className="w-4 h-4 text-emerald-600" /> My Orders
                                        </Link>
                                        <Link href="/account/addresses" onClick={closeMobileMenu} className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700 transition-colors border-t border-gray-50">
                                            <FiMapPin className="w-4 h-4 text-emerald-600" /> Addresses
                                        </Link>
                                        <button
                                            onClick={() => { logout(); closeMobileMenu(); router.push("/"); }}
                                            className="w-full text-left flex items-center gap-2.5 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-gray-50"
                                        >
                                            <FiLogOut className="w-4 h-4" /> Sign out
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Link
                                        href="/account/login"
                                        onClick={closeMobileMenu}
                                        className="flex-1 text-center px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                    >
                                        Sign in
                                    </Link>
                                    <Link
                                        href="/account/register"
                                        onClick={closeMobileMenu}
                                        className="flex-1 text-center px-4 py-2.5 rounded-xl ring-1 ring-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>

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
                    <div
                        className="p-4 border-t border-gray-100 text-emerald-50"
                        style={{ backgroundImage: "linear-gradient(to bottom right, var(--theme-footer-from), var(--theme-footer-to))" }}
                    >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300 font-semibold mb-2">
                            Need help?
                        </p>
                        <a
                            href="tel:+10000000000"
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
