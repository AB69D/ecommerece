import { Suspense } from "react";
import ProductBrowser from "@/components/ProductBrowser";

// useSearchParams (inside ProductBrowser) must sit under a Suspense boundary so
// the static shell can render while the client reads the query string.
function BrowserFallback() {
    return (
        <div className="w-full py-20 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<BrowserFallback />}>
            <ProductBrowser />
        </Suspense>
    );
}
