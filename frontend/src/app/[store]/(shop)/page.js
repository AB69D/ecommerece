import Showcase from "@/components/Showcase.jsx";
import NewArrivals from "@/components/New-Arraivals.jsx";
import AllProducts from "@/components/AllProducts.jsx";
import TopSelling from "@/components/TopSelling.jsx";
import CustomerReviews from "@/components/CustomerReviews.jsx";

export const metadata = {
    title: "Ab9dEcommerce - Quality Products | Wide Selection",
    description: "Shop quality products at Ab9dEcommerce. We offer a wide selection of quality products across multiple categories.",
    keywords: "Ab9dEcommerce, products, pure various products, quality products, traditional food, products",
    openGraph: {
        title: "Ab9dEcommerce - quality products",
        description: "Shop quality products at Ab9dEcommerce. Premium quality various products, and quality products.",
        url: "https://example.com",
        siteName: "Ab9dEcommerce",
        images: [
            {
                url: "/logo.png",
                width: 800,
                height: 600,
                alt: "Ab9dEcommerce Logo"
            }
        ],
        type: "website"
    },
    twitter: {
        card: "summary_large_image",
        title: "Ab9dEcommerce - quality products",
        description: "Shop quality products at Ab9dEcommerce",
        images: ["/logo.png"]
    }
};

export default function Home() {
  return (
    <div>
      <Showcase />
      <NewArrivals />
      <TopSelling />
      <AllProducts />
      <CustomerReviews />
    </div>
  );
}
