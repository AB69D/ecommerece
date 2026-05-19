"use client";
import { useState, useEffect } from "react";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";

export default function CategoryProducts({ categorySlug }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categoryName, setCategoryName] = useState("");

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/client/product/products?limit=50`);
                const data = await res.json();

                if (data.success) {
                    const filteredProducts = data.data.filter(p => {
                        const catName = p.category?.category_name?.toLowerCase().replace(/\s+/g, "-");
                        return catName === categorySlug;
                    });
                    setProducts(filteredProducts);
                    if (filteredProducts.length > 0) {
                        setCategoryName(filteredProducts[0].category?.category_name || "");
                    }
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

        if (categorySlug) {
            fetchProducts();
        }
    }, [categorySlug]);

    if (loading) {
        return (
            <div className="w-full py-8 px-4 max-w-7xl mx-auto">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-8" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
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
            <h1 className="text-3xl font-bold text-gray-800 mb-8">
                {categoryName || categorySlug}
            </h1>
            
            {products.length === 0 ? (
                <p className="text-gray-500">No products found in this category</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 fade-in-stagger">
                    {products.map((product) => (
                        <a
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
                                <h3 className="font-medium text-gray-800">{product.firstName}</h3>
                                {product.lastName && (
                                    <p className="text-sm text-gray-500">{product.lastName}</p>
                                )}
                                {product.weights && product.weights.length > 0 && (
                                    <p className="text-emerald-600 font-bold mt-2">
                                        ${product.weights[0].price}
                                    </p>
                                )}
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}