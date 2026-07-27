"use client";

import { BRAND } from "@/lib/content";
import { whatsAppUrl } from "@/lib/labels";
import WhatsAppIcon from "@/components/shared/WhatsAppIcon";

export default function WhatsAppButton() {
  const url = whatsAppUrl(BRAND.whatsapp, "Hello! I'd like to learn more about My Institute.");

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110"
      aria-label="Chat on WhatsApp"
    >
      <WhatsAppIcon className="w-6 h-6" />
    </a>
  );
}
