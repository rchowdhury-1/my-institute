import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://my-institute-eight.vercel.app";

export const metadata: Metadata = {
  title: {
    template: "My Institute | %s",
    default: "My Institute | Online Quran, Arabic & Islamic Studies",
  },
  description:
    "Online Quran, Arabic, and Islamic studies lessons for all ages. Expert teachers, flexible scheduling, one-to-one private lessons.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: "My Institute",
    type: "website",
    locale: "en_GB",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-cream text-charcoal antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
