import { Video, ExternalLink } from "lucide-react";
import { isSessionJoinable, isSessionBeforeStart, formatTimeOnly, JOIN_WINDOW_HOURS } from "@/lib/datetime";

const VARIANT_CLASS = {
  emerald: "bg-emerald-primary text-white hover:bg-emerald-light",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
};

interface JoinSessionButtonProps {
  zoomLink?: string | null;
  scheduledAt: string;
  skewMs: number;
  label?: string;
  variant?: keyof typeof VARIANT_CLASS;
  /** Layout classes (margin, display type, width) — left to the caller since these vary by surrounding context. */
  className?: string;
}

/**
 * The before/during/after join-window trio: nothing before the early
 * window, a live join link during it, "Starts at {time}" before it, and
 * nothing once the window has closed.
 */
export default function JoinSessionButton({
  zoomLink,
  scheduledAt,
  skewMs,
  label = "Join Session",
  variant = "emerald",
  className = "",
}: JoinSessionButtonProps) {
  if (!zoomLink) return null;

  if (isSessionJoinable(scheduledAt, JOIN_WINDOW_HOURS, { skewMs })) {
    return (
      <a
        href={zoomLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${VARIANT_CLASS[variant]}`}
      >
        <Video size={14} />
        {label}
        <ExternalLink size={12} />
      </a>
    );
  }

  if (isSessionBeforeStart(scheduledAt, skewMs)) {
    return (
      <p className={`${className} items-center gap-2 px-4 py-2 rounded-full bg-black/5 text-charcoal/50 text-sm font-medium`}>
        <Video size={14} />
        Starts at {formatTimeOnly(scheduledAt)}
      </p>
    );
  }

  return null;
}
