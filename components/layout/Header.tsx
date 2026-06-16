"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import MobileMenu from "./MobileMenu";
import NotificationBell from "./NotificationBell";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/packages", label: "Packages" },
  { href: "/learn-about-islam", label: "Reverts" },
  { href: "/community", label: "Community" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [dashboardHref, setDashboardHref] = useState("/student/dashboard");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    setLoggedIn(!!localStorage.getItem("accessToken"));
    const role = document.cookie.match(/(?:^|; )userRole=([^;]*)/)?.[1];
    if (role === "admin" || role === "supervisor") setDashboardHref("/supervisor");
    else if (role === "teacher") setDashboardHref("/teacher/dashboard");
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
            {/* Logo + Nav cluster */}
            <div className="flex items-center gap-9">
              <Link href="/" className="flex items-center">
                <Image
                  src="/images/logo.png"
                  alt="Logo"
                  height={72}
                  width={160}
                  style={{ height: "72px", width: "auto", objectFit: "contain", filter: scrolled ? "none" : "invert(1)" }}
                  priority
                />
              </Link>

              <nav className="hidden lg:flex items-center gap-7">
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
              </nav>
            </div>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <NotificationBell />
              {loggedIn !== null && (
                <Link
                  href={loggedIn ? dashboardHref : "/login"}
                  className={`hidden lg:inline-flex text-sm font-medium transition-colors ${
                    scrolled
                      ? "text-charcoal hover:text-emerald-primary"
                      : "text-cream hover:text-white"
                  }`}
                >
                  {loggedIn ? "Dashboard" : "Login"}
                </Link>
              )}
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
        links={NAV_LINKS}
        loggedIn={loggedIn}
        dashboardHref={dashboardHref}
      />
    </>
  );
}
