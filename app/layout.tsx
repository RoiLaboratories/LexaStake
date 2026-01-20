import type { Metadata } from "next";
import { Sora, Cinzel } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Image from "next/image";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LEXASTAKE - Secure Your Crypto Future With Lexastake",
  description: "Trade cryptocurrencies with ease on Tower Finance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${cinzel.variable} antialiased`}>
        {/* Background Image - Fixed to viewport */}
        <div className="fixed inset-0 z-0">
          <Image
            src="/assets/bg-background.svg"
            alt="Background"
            fill
            className="object-cover"
            priority
            quality={90}
          />
          {/* Black to Green gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-b from-black/80 via-black/50 to-green-900/60" />
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col relative z-10">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
