"use client";
import Link, { storeHref } from "@/components/StoreLink";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { FiUser, FiPackage, FiMapPin, FiLogOut } from "react-icons/fi";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const NAV = [
    { href: "/account", label: "Profile", Icon: FiUser },
    { href: "/account/orders", label: "My Orders", Icon: FiPackage },
    { href: "/account/addresses", label: "Addresses", Icon: FiMapPin },
];

// Shared chrome + auth guard for every signed-in account page. While the auth
// context is still bootstrapping it shows a spinner; once settled, an
// unauthenticated visitor is bounced to login (preserving where they were
// headed via ?next=). Login/register pages deliberately do NOT use this shell.
export default function AccountShell({ children, title, subtitle }) {
    const { customer, loading, logout } = useCustomerAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { store } = useParams();

    useEffect(() => {
        if (!loading && !customer) {
            router.replace(storeHref(`/account/login?next=${encodeURIComponent(pathname)}`, store));
        }
    }, [loading, customer, pathname, router]);

    if (loading || !customer) {
        return (
            <div className="py-24 flex justify-center">
                <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="py-6 sm:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
                {/* Sidebar */}
                <aside className="lg:sticky lg:top-24 h-max">
                    <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
                            <div className="flex items-center gap-3">
                                <span className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                                    <FiUser className="w-5 h-5" />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{customer.name}</p>
                                    <p className="text-xs text-emerald-50/90 truncate">{customer.email}</p>
                                </div>
                            </div>
                        </div>
                        <nav className="p-2">
                            {NAV.map(({ href, label, Icon }) => {
                                const active = pathname === href;
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                            active
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${active ? "text-emerald-600" : "text-gray-400"}`} />
                                        {label}
                                    </Link>
                                );
                            })}
                            <button
                                onClick={() => { logout(); router.push(storeHref("/", store)); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                                <FiLogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </nav>
                    </div>
                </aside>

                {/* Main */}
                <section>
                    {title && (
                        <div className="mb-5">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
                            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                        </div>
                    )}
                    {children}
                </section>
            </div>
        </div>
    );
}
