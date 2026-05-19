import Showcase from "@/components/Showcase.jsx";
import NewArrivals from "@/components/New-Arraivals.jsx";
import AllProducts from "@/components/AllProducts.jsx";
import TopSelling from "@/components/TopSelling.jsx";
import CustomerReviews from "@/components/CustomerReviews.jsx";

export const metadata = {
    title: "Gram2Ghor - Pure Organic Products | Ghee, Honey, Oil & More",
    description: "Shop pure organic products at Gram2Ghor. We offer premium quality ghee, honey, mustard oil, dates, and traditional Bengali food products.",
    keywords: "Gram2Ghor, organic food, pure ghee, honey, mustard oil, Bengali food, traditional food, organic products Bangladesh",
    openGraph: {
        title: "Gram2Ghor - Pure Organic Products",
        description: "Shop pure organic products at Gram2Ghor. Premium quality ghee, honey, mustard oil, and traditional Bengali food products.",
        url: "https://gram2ghor.com",
        siteName: "Gram2Ghor",
        images: [
            {
                url: "/logo.png",
                width: 800,
                height: 600,
                alt: "Gram2Ghor Logo"
            }
        ],
        type: "website"
    },
    twitter: {
        card: "summary_large_image",
        title: "Gram2Ghor - Pure Organic Products",
        description: "Shop pure organic products at Gram2Ghor",
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
