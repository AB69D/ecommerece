import { FiCheckCircle, FiShoppingBag, FiMonitor, FiShield } from "react-icons/fi";
import SignupForm from "./SignupForm";

export const metadata = {
    title: "Open your store | Ab9dEcommerce",
    description:
        "Launch your own online store and point-of-sale in minutes. Register your business, get approved, and start selling — your products, your storefront, fully managed from one admin panel.",
    keywords: "open online store, sell online, ecommerce platform, POS, start selling, store signup",
    alternates: { canonical: "/sell" },
    openGraph: {
        title: "Open your store | Ab9dEcommerce",
        description:
            "Launch your own online store and point-of-sale in minutes. Register, get approved, and start selling.",
        url: "/sell",
        siteName: "Ab9dEcommerce",
        type: "website",
    },
};

const BENEFITS = [
    {
        icon: FiShoppingBag,
        title: "Your own online store",
        body: "A complete storefront with products, categories, discounts and checkout — yours to brand and customize.",
    },
    {
        icon: FiMonitor,
        title: "Built-in point of sale",
        body: "Sell in person too. The same catalog and stock power a fast POS for your counter.",
    },
    {
        icon: FiShield,
        title: "Fully isolated & secure",
        body: "Your products, orders and customers live in your own space — never mixed with another store.",
    },
];

export default function SellPage() {
    return (
        <div className="py-8 sm:py-12">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
                {/* ── Pitch ───────────────────────────────────────────────── */}
                <div className="lg:pt-6">
                    <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold tracking-wide mb-4">
                        SELL WITH US
                    </span>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                        Start selling online<br className="hidden sm:block" /> in minutes.
                    </h1>
                    <p className="mt-4 text-gray-600 text-lg leading-relaxed max-w-md">
                        Register your business, get approved, and run a complete ecommerce store and
                        point-of-sale — all from one admin panel.
                    </p>

                    <ul className="mt-8 space-y-5">
                        {BENEFITS.map((b) => (
                            <li key={b.title} className="flex gap-4">
                                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <b.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{b.title}</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">{b.body}</p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
                        <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                        No setup fees — review usually takes under a day.
                    </div>
                </div>

                {/* ── Form ────────────────────────────────────────────────── */}
                <div id="signup">
                    <SignupForm />
                </div>
            </div>
        </div>
    );
}
