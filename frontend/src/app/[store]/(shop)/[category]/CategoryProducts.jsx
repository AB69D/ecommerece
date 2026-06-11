"use client";
import { Suspense } from "react";
import ProductBrowser from "@/components/ProductBrowser";

// Category landing page: the same browse surface as /search, but with the
// category pinned (its filter is hidden) so shoppers only sort/filter within it.
// All the search, filtering, sorting and pagination is server-side.
export default function CategoryProducts({ categorySlug }) {
    return (
        <Suspense
            fallback={
                <div className="w-full py-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            }
        >
            <ProductBrowser lockedCategorySlug={categorySlug} fallbackHeading={categorySlug} />
        </Suspense>
    );
}
