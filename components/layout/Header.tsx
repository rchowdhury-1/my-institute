"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import MobileMenu from "./MobileMenu";
import NotificationBell from "./NotificationBell";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/packages", label: "Packages" },
  { href: "/free-trial", label: "Free Trial" },
  { href: "/recorded-courses", label: "Recorded Courses" },
  { href: "/donate", label: "Donate" },
];

const LOGIN_LINKS = [
  { href: "/login?role=student", label: "Student Login" },
  { href: "/login?role=teacher", label: "Teacher Login" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-emerald-primary/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Logo"
                height={60}
                width={160}
                style={{ height: "60px", width: "auto", objectFit: "contain", filter: scrolled ? "none" : "invert(1)" }}
                priority
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    scrolled
                      ? "text-charcoal hover:text-emerald-primary"
                      : "text-cream hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className={`w-px h-4 ${scrolled ? "bg-black/10" : "bg-white/30"}`} />
              {LOGIN_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    scrolled
                      ? "text-charcoal/60 hover:text-emerald-primary"
                      : "text-cream/70 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link
                href="/free-trial"
                className="hidden sm:inline-flex items-center px-4 py-2 rounded-full bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors shadow-sm"
              >
                Book Free Trial
              </Link>
              <button
                onClick={() => setMobileOpen(true)}
                className={`lg:hidden p-2 rounded-lg transition-colors ${
                  scrolled
                    ? "text-charcoal hover:bg-emerald-primary/10"
                    : "text-cream hover:bg-white/10"
                }`}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={[...NAV_LINKS, ...LOGIN_LINKS]}
      />
    </>
  );
}
