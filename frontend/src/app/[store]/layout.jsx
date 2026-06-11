import { notFound } from "next/navigation";
import { validateStore } from "@/lib/storeContext.js";

// ── Store segment ────────────────────────────────────────────────────────────
// Everything a single store owns — storefront ((shop)), admin and pos — lives
// under /<store>. This layout is the one gate they share: it confirms <store>
// resolves to a real, approved tenant and 404s otherwise, so a bogus slug never
// renders a half-empty store or admin. It adds no chrome (each surface brings its
// own); the storefront's branding/theme is applied in (shop)/layout.
export default async function StoreLayout({ children, params }) {
    const { store } = await params;
    if (!(await validateStore(store))) notFound();
    return children;
}
