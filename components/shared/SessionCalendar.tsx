"use client";

import { useMemo, useState, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  format,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LONDON = "Europe/London";
const CAIRO = "Africa/Cairo";

interface Session {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  subject?: string;
  student_name?: string;
  teacher_name?: string;
  schedule_id?: string | null;
}

interface SessionCalendarProps {
  sessions: Session[];
  mode: "week" | "month";
  onModeChange: (mode: "week" | "month") => void;
  nameField: "student_name" | "teacher_name";
  onSessionClick?: (session: Session) => void;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  scheduled:         { bg: "bg-blue-50",    border: "border-blue-400",    text: "text-blue-700",    label: "Scheduled" },
  completed:         { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", label: "Completed" },
  cancelled:         { bg: "bg-gray-50",    border: "border-gray-400",    text: "text-gray-500",    label: "Cancelled" },
  rescheduled:       { bg: "bg-amber-50",   border: "border-amber-400",   text: "text-amber-700",   label: "Rescheduled" },
  no_show:           { bg: "bg-red-50",     border: "border-red-400",     text: "text-red-700",     label: "No-show" },
  cancelled_teacher: { bg: "bg-orange-50",  border: "border-orange-400",  text: "text-orange-700",  label: "Teacher cancelled" },
};

const SUBJECT_LABELS: Record<string, string> = {
  quran: "Quran",
  arabic: "Arabic",
  islamic_studies: "Islamic Studies",
};

function londonTime(d: Date): string {
  return format(toZonedTime(d, LONDON), "HH:mm");
}

function cairoTime(d: Date): string {
  return format(toZonedTime(d, CAIRO), "HH:mm");
}

function londonDate(d: Date): Date {
  return toZonedTime(d, LONDON);
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SessionCalendar({
  sessions,
  mode,
  onModeChange,
  nameField,
  onSessionClick,
}: SessionCalendarProps) {
  const [anchor, setAnchor] = useState(() => new Date());

  // Build a map of London-date-string → sessions for O(1) lookup
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const d = londonDate(new Date(s.scheduled_at));
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Sort each day's sessions by time
    Array.from(map.values()).forEach((arr) => {
      arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    });
    return map;
  }, [sessions]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setAnchor((prev) =>
        mode === "week" ? addWeeks(prev, dir) : addMonths(prev, dir)
      );
    },
    [mode]
  );

  const goToday = useCallback(() => setAnchor(new Date()), []);

  // Compute visible days
  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    // Month: pad to full weeks
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [anchor, mode]);

  const headerLabel =
    mode === "week"
      ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}`
      : format(anchor, "MMMM yyyy");

  function SessionPill({ session }: { session: Session }) {
    const style = STATUS_STYLES[session.status] || STATUS_STYLES.scheduled;
    const d = new Date(session.scheduled_at);
    const name = session[nameField] || "";
    const subject = session.subject ? SUBJECT_LABELS[session.subject] || session.subject : "";
    const ariaLabel = `${format(londonDate(d), "EEE d MMM")}, ${londonTime(d)}, ${style.label}${subject ? ` ${subject}` : ""} lesson${name ? ` with ${name}` : ""}`;

    return (
      <button
        onClick={() => onSessionClick?.(session)}
        className={`w-full text-left px-2 py-1 rounded-md border-l-2 ${style.bg} ${style.border} ${
          onSessionClick ? "cursor-pointer hover:opacity-80" : "cursor-default"
        } transition-opacity`}
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <p className={`text-xs font-medium ${style.text} truncate`}>
          {londonTime(d)}
          <span className="text-[10px] opacity-60 ml-1">{cairoTime(d)} Cairo</span>
        </p>
        {name && (
          <p className="text-[11px] text-charcoal/60 truncate">{name}</p>
        )}
        {mode === "week" && subject && (
          <p className="text-[10px] text-charcoal/40 truncate">
            {subject} · {session.duration_minutes}min
          </p>
        )}
      </button>
    );
  }

  // Week view
  function WeekView() {
    return (
      <div className="grid grid-cols-7 gap-px bg-black/5 rounded-xl overflow-hidden border border-black/5">
        {/* Day headers */}
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-2 ${
              isToday(days[i]) ? "bg-emerald-primary/10 text-emerald-primary" : "bg-white text-charcoal/50"
            }`}
          >
            {d}
          </div>
        ))}
        {/* Day cells */}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate.get(key) || [];
          const today = isToday(day);
          return (
            <div
              key={key}
              className={`min-h-[120px] p-1.5 flex flex-col gap-1 ${
                today ? "bg-emerald-primary/5" : "bg-white"
              }`}
            >
              <span
                className={`text-xs font-medium mb-0.5 ${
                  today
                    ? "text-emerald-primary font-bold"
                    : "text-charcoal/40"
                }`}
              >
                {format(day, "d")}
              </span>
              {daySessions.map((s) => (
                <SessionPill key={s.id} session={s} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // Month view
  function MonthView() {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);

    return (
      <div className="grid grid-cols-7 gap-px bg-black/5 rounded-xl overflow-hidden border border-black/5">
        {/* Day headers */}
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium py-2 bg-white text-charcoal/50"
          >
            {d}
          </div>
        ))}
        {/* Day cells */}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate.get(key) || [];
          const today = isToday(day);
          const inMonth = day >= monthStart && day <= monthEnd;

          return (
            <div
              key={key}
              className={`min-h-[80px] p-1.5 flex flex-col gap-0.5 ${
                today ? "bg-emerald-primary/5" : inMonth ? "bg-white" : "bg-gray-50/50"
              }`}
            >
              <span
                className={`text-xs mb-0.5 ${
                  today
                    ? "text-emerald-primary font-bold"
                    : inMonth
                      ? "text-charcoal/60 font-medium"
                      : "text-charcoal/25"
                }`}
              >
                {format(day, "d")}
              </span>
              {daySessions.slice(0, 3).map((s) => (
                <SessionPill key={s.id} session={s} />
              ))}
              {daySessions.length > 3 && (
                <p className="text-[10px] text-charcoal/40 text-center">
                  +{daySessions.length - 3} more
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
            aria-label={`Previous ${mode}`}
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-display text-sm font-semibold text-charcoal min-w-[160px] text-center">
            {headerLabel}
          </h3>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
            aria-label={`Next ${mode}`}
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToday}
            className="px-2.5 py-1 rounded-lg border border-black/10 text-xs font-medium text-charcoal/60 hover:bg-black/5 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex rounded-lg border border-black/10 overflow-hidden">
          <button
            onClick={() => onModeChange("week")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              mode === "week"
                ? "bg-emerald-primary text-white"
                : "text-charcoal/60 hover:bg-black/5"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onModeChange("month")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              mode === "month"
                ? "bg-emerald-primary text-white"
                : "text-charcoal/60 hover:bg-black/5"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(STATUS_STYLES).map(([key, style]) => (
          <span key={key} className={`px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
            {style.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        {mode === "week" ? <WeekView /> : <MonthView />}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <p className="text-center text-charcoal/40 text-sm py-6">
          No sessions to display
        </p>
      )}
    </div>
  );
}
