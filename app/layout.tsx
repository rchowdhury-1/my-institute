import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  title: {
    template: "My Institute | %s",
    default: "My Institute | Online Quran, Arabic & Islamic Studies",
  },
  description:
    "Online Quran, Arabic, and Islamic studies lessons for all ages. Expert teachers, flexible scheduling, one-to-one private lessons.",
  metadataBase: new URL("https://my-institute.vercel.app"),
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
    <html lang="en">
      <body className="bg-cream text-charcoal antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
