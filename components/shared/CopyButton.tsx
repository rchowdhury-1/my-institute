"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { COPY_FEEDBACK_MS } from "@/lib/labels";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
      })
      .catch((err) => console.error("[CopyButton] copy failed:", err));
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-black/5 transition-colors text-charcoal/50 hover:text-charcoal"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check size={14} className="text-emerald-primary" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}
