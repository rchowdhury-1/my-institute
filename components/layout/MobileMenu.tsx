"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect } from "react";
import { BRAND } from "@/lib/content";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
}

export default function MobileMenu({ isOpen, onClose, links }: MobileMenuProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <span className="font-display text-lg font-bold text-emerald-primary">
            {BRAND.name}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-charcoal hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block px-6 py-3 text-charcoal font-medium hover:bg-emerald-primary/5 hover:text-emerald-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-5 border-t border-gray-100">
          <Link
            href="/free-trial"
            onClick={onClose}
            className="block w-full text-center px-4 py-3 rounded-full bg-gold text-white font-semibold hover:bg-gold-dark transition-colors"
          >
            Book Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
