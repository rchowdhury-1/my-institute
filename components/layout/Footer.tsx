import Link from "next/link";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { BRAND } from "@/lib/content";
import { whatsAppUrl } from "@/lib/labels";
import WhatsAppIcon from "@/components/shared/WhatsAppIcon";

const QUICK_LINKS = [
  { href: "/about", label: "About" },
  { href: "/packages", label: "Packages" },
  { href: "/learn-about-islam", label: "Reverts" },
  { href: "/community", label: "Community" },
  { href: "/scholarship", label: "Scholarship" },
  { href: "/donate", label: "Donate" },
  { href: "/login", label: "Login" },
];

// Social media SVG icons
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.47a8.16 8.16 0 0 0 4.77 1.52V7.54a4.85 4.85 0 0 1-1-.85z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function Footer() {
  const footerWhatsappUrl = whatsAppUrl(BRAND.whatsapp);

  return (
    <footer className="bg-charcoal text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <Image
              src="/images/logo.png"
              alt="Logo"
              height={48}
              width={200}
              style={{ height: "48px", width: "auto", filter: "brightness(0) invert(1)" }}
              className="mb-1"
            />
            <p className="text-gold text-sm font-medium mb-4">{BRAND.tagline}</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Private online lessons in Quran, Arabic, and Islamic Studies for all ages and levels.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4 uppercase tracking-wider text-xs">
              Quick Links
            </h4>
            <ul className="space-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="font-semibold text-white mb-4 uppercase tracking-wider text-xs">
              Contact
            </h4>
            <div className="space-y-3 mb-6">
              <a
                href={`mailto:${BRAND.email}`}
                className="flex items-center gap-2 text-gray-400 hover:text-gold transition-colors text-sm"
              >
                <Mail size={15} />
                {BRAND.email}
              </a>
              <a
                href={`tel:${BRAND.phone}`}
                className="flex items-center gap-2 text-gray-400 hover:text-gold transition-colors text-sm"
              >
                <Phone size={15} />
                {BRAND.phone}
              </a>
            </div>

            <h4 className="font-semibold text-white mb-3 uppercase tracking-wider text-xs">
              Follow Us
            </h4>
            <div className="flex items-center gap-3">
              <a
                href={footerWhatsappUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 text-gray-400 hover:bg-green-600 hover:text-white transition-all"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon />
              </a>
              <a
                href={BRAND.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 text-gray-400 hover:bg-blue-600 hover:text-white transition-all"
                aria-label="Facebook"
              >
                <FacebookIcon />
              </a>
              <a
                href={BRAND.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 text-gray-400 hover:bg-pink-600 hover:text-white transition-all"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
              <a
                href={BRAND.social.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 text-gray-400 hover:bg-charcoal-light hover:text-white transition-all"
                aria-label="TikTok"
              >
                <TikTokIcon />
              </a>
              <a
                href={BRAND.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 text-gray-400 hover:bg-red-600 hover:text-white transition-all"
                aria-label="YouTube"
              >
                <YouTubeIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-gray-500 text-sm">
            © 2026 {BRAND.name}. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs mt-2">Made by Razwanul Chowdhury — <a href="https://portfolio-project-tau-olive.vercel.app" target="_blank" rel="noopener noreferrer" className="underline text-gray-400 hover:text-white transition-colors">Get in touch</a></p>
        </div>
      </div>
    </footer>
  );
}
