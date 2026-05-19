import ProductClient from "./ProductClient";

export async function generateMetadata({ params }) {
    const { id } = await params;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    
    try {
        const res = await fetch(`${backendUrl}/api/client/product/product/${id}`);
        const data = await res.json();
        
        if (data.success && data.data) {
            const product = data.data;
            const productName = `${product.firstName} ${product.lastName || ''}`.trim();
            const description = product.description || `${productName} - Available at Gram2Ghor`;
            const image = product.cover_image || (product.weights?.[0]?.images?.[0]) || `${backendUrl}/logo.png`;
            const price = product.weights?.[0]?.price || 0;
            
            return {
                title: `${productName} - ৳${price} | Gram2Ghor`,
                description: description,
                keywords: [product.firstName, product.lastName, product.category?.category_name, 'Gram2Ghor', 'organic products'].filter(Boolean).join(', '),
                openGraph: {
                    title: productName,
                    description: description,
                    images: [
                        {
                            url: image,
                            width: 800,
                            height: 600,
                            alt: productName
                        }
                    ],
                    type: 'website',
                    siteName: 'Gram2Ghor'
                },
                twitter: {
                    card: 'summary_large_image',
                    title: productName,
                    description: description,
                    images: [image]
                }
            };
        }
    } catch (error) {
        console.error('Error generating metadata:', error);
    }
    
    return {
        title: 'Product Details | Gram2Ghor',
        description: 'View product details at Gram2Ghor'
    };
}

export default async function ProductDetailsPage({ params }) {
    const { id } = await params;
    return <ProductClient productId={id} />;
}