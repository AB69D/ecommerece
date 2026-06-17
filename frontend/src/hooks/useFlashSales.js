"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

// Returns a Map<`${productId}:${weightIndex}`, flashSaleEntry> for all items
// in currently-live flash sales. Used by ProductCard and ProductClient to
// show flash badges, strikethrough prices and countdown timers.
//
// The hook re-fetches whenever the store slug changes. It does NOT poll — flash
// sale prices are only needed at add-to-cart / checkout time, and the server
// validates them there anyway.
export function useFlashSales() {
    const params = useParams();
    const store = params?.store || "";

    const [flashMap, setFlashMap] = useState(new Map());
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/client/flash-sale/active", {
                headers: store ? { "X-Tenant": store } : {},
            });
            const json = await res.json();
            if (json?.success && Array.isArray(json.data)) {
                const map = new Map();
                for (const sale of json.data) {
                    for (const item of sale.items || []) {
                        const key = `${item.productId}:${item.weightIndex}`;
                        // When two overlapping sales cover the same variant, the
                        // lowest price wins (mirrors the server-side logic).
                        if (!map.has(key) || item.salePrice < map.get(key).salePrice) {
                            map.set(key, {
                                saleId: sale._id,
                                saleTitle: sale.title,
                                salePrice: item.salePrice,
                                endsAt: sale.endsAt,
                                maxQty: item.maxQty,
                                soldQty: item.soldQty,
                            });
                        }
                    }
                }
                setFlashMap(map);
            }
        } catch {
            // Non-fatal: storefront still works without flash prices.
        } finally {
            setLoading(false);
        }
    }, [store]);

    useEffect(() => { load(); }, [load]);

    return { flashMap, loading, refresh: load };
}
