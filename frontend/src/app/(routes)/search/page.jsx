"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SearchContent() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const searchParams = useSearchParams();
    useEffect(() => {
        const query = searchParams.get('q') || '';
        setSearchQuery(query);
        if (query) {
            fetchSearchResults(query);
        } else {
            setLoading(false);
        }
    }, [searchParams]);

    const fetchSearchResults = async (query) => {
        try {
            const res = await fetch(`/api/client/product/products?limit=50`);
            const data = await res.json();

            if (data.success) {
                const filteredProducts = data.data.filter(p => {
                    const name = (p.firstName + ' ' + (p.lastName || '')).toLowerCase();
                    return name.includes(query.toLowerCase());
                });
                setProducts(filteredProducts);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError("Failed to fetch products");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-gray-500">Searching...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full py-8 px-4 max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                Search Results for &quot;{searchQuery}&quot;
            </h1>
            <p className="text-gray-500 mb-8">
                {products.length} {products.length === 1 ? 'product' : 'products'} found
            </p>
            
            {products.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No products found matching your search.</p>
                    <Link href="/" className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block">
                        Continue Shopping
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 fade-in-stagger">
                    {products.map((product) => (
                        <Link
                            key={product._id}
                            href={`/product/${product._id}`}
                            className="card-hover block bg-white rounded-xl border border-gray-100 overflow-hidden"
                        >
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                    src={product.cover_image}
                                    alt={product.firstName}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-4">
                                <h3 className="font-medium text-gray-800 line-clamp-1">{product.firstName}</h3>
                                {product.lastName && (
                                    <p className="text-sm text-gray-500 line-clamp-1">{product.lastName}</p>
                                )}
                                {product.weights && product.weights.length > 0 && (
                                    <p className="text-emerald-600 font-bold mt-2">
                                        ৳{product.weights[0].price}
                                    </p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}