import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import ChatFloatingButton from "@/components/ChatFloatingButton.jsx";
import FetchPatch from "@/components/FetchPatch.jsx";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://gram2ghor.com"),
  title: "Gram2ghor - Collections of Organic Products",
  description: "Gram2ghor is promising to deliver organic food products from direct gram to your home",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gram2ghor.com",
    siteName: "Gram2Ghor",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
        alt: "Gram2Ghor Logo"
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
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FetchPatch />
        <HeaderTop />
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </main>
        <Footer />
        <ChatFloatingButton />
      </body>
    </html>
  );
}
