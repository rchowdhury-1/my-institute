export const SUBJECT_LABELS: Record<string, string> = {
  quran: "Quran",
  arabic: "Arabic",
  islamic_studies: "Islamic Studies",
};

export function subjectLabel(s?: string | null): string {
  if (!s) return "";
  return SUBJECT_LABELS[s] ?? s;
}

/**
 * Canonical session status colours. Three sites (supervisor, teacher
 * dashboard, student sessions) already agreed on these bg/text pairs;
 * SessionCalendar had drifted to an unrelated palette (scheduled=blue,
 * completed=emerald, no_show=red, cancelled_teacher=orange) — reconciled
 * to the majority scheme here. `border` is new for calendar day-cells,
 * chosen to match each status's badge colour family.
 */
export const SESSION_STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  scheduled: { bg: "bg-emerald-primary/10", text: "text-emerald-primary", border: "border-emerald-400" },
  completed: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-400" },
  cancelled: { bg: "bg-red-50", text: "text-red-500", border: "border-red-400" },
  rescheduled: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-400" },
  no_show: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-400" },
  cancelled_teacher: { bg: "bg-red-50", text: "text-red-500", border: "border-red-400" },
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  no_show: "No-show",
  cancelled_teacher: "Teacher cancelled",
};

export const DURATION_OPTIONS = [30, 60, 90, 120] as const;

// "Copied!" feedback duration on CopyButton components (admin/teachers,
// admin/students).
export const COPY_FEEDBACK_MS = 2000;

// Supervisor-facing "getting low" indicator on a weekly schedule's hours
// balance — distinct from RENEWAL_REMINDER_HOURS, which is the backend's
// own reminder-notification trigger shown to students.
export const LOW_BALANCE_AMBER_HOURS = 4;

// Backend twin: RENEWAL_REMINDER_HOURS in backend/src/config.js — keep in
// sync until B11 unifies cross-tier constants.
export const RENEWAL_REMINDER_HOURS = 2;

export function whatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const num = (phone || "").replace(/[^0-9]/g, "");
  if (!num) return null;
  return message ? `https://wa.me/${num}?text=${encodeURIComponent(message)}` : `https://wa.me/${num}`;
}
