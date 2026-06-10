import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import OrderChatbot from "@/components/OrderChatbot.jsx";
import PwaRegister from "@/components/PwaRegister.jsx";
import { CurrencyProvider } from "@/context/CurrencyContext.jsx";
import { fetchSiteSettings } from "@/lib/dynamicContent.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://example.com"),
  title: "Ab9dEcommerce - Quality Products Online",
  description: "Ab9dEcommerce is promising to deliver products from our store to your door",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://example.com",
    siteName: "Ab9dEcommerce",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
        alt: "Ab9dEcommerce Logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#0f766e",
};

export default async function RootLayout({ children }) {
  const settings = await fetchSiteSettings();
  const currencySymbol = settings?.currencySymbol || "$";
  const currencyCode = settings?.currencyCode || "USD";
  const pwaEnabled = settings?.features?.pwa !== false;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CurrencyProvider initialSymbol={currencySymbol} initialCode={currencyCode}>
          <HeaderTop />
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
          <OrderChatbot />
          <PwaRegister enabled={pwaEnabled} />
        </CurrencyProvider>
      </body>
    </html>
  );
}
