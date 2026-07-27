import { RENEWAL_REMINDER_HOURS } from "./shared/constants";

export { RENEWAL_REMINDER_HOURS };

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

export const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
export const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DURATION_OPTIONS = [30, 60, 90, 120] as const;

// "Copied!" feedback duration on CopyButton components (admin/teachers,
// admin/students).
export const COPY_FEEDBACK_MS = 2000;

// Supervisor-facing "getting low" indicator on a weekly schedule's hours
// balance — distinct from RENEWAL_REMINDER_HOURS, which is the backend's
// own reminder-notification trigger shown to students.
export const LOW_BALANCE_AMBER_HOURS = 4;

export function dashboardPathForRole(role?: string | null): string {
  if (role === "admin" || role === "supervisor") return "/supervisor";
  if (role === "teacher") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function whatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const num = (phone || "").replace(/[^0-9]/g, "");
  if (!num) return null;
  return message ? `https://wa.me/${num}?text=${encodeURIComponent(message)}` : `https://wa.me/${num}`;
}

/**
 * Balance unit: schedules hold hours; legacy packages still count lessons.
 */
export function getBalanceCopy(source: "schedules" | "package" | "none") {
  const unit = source === "package" ? "lesson" : "hour";
  const balanceEmptyMsg = unit === "hour"
    ? "You have no hours remaining. Please contact admin to renew."
    : "Your lesson balance is 0. Please contact admin to renew.";
  const balanceEmptyWa = unit === "hour"
    ? "Hi, I have no hours remaining. I'd like to renew."
    : "Hi, my lesson balance has reached 0. I'd like to renew.";
  return { unit, balanceEmptyMsg, balanceEmptyWa };
}
