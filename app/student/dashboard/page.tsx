"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ExternalLink, MessageCircle, ClipboardList } from "lucide-react";
import { formatSessionDate, formatTimeOnly, formatSimpleDate, formatHours, computeClockSkew } from "@/lib/datetime";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useLogout } from "@/lib/useLogout";
import { BRAND, EXAM_PORTAL_URL } from "@/lib/content";
import { subjectLabel, whatsAppUrl, RENEWAL_REMINDER_HOURS, getBalanceCopy } from "@/lib/labels";
import PageLoading from "@/components/shared/PageLoading";
import PageError from "@/components/shared/PageError";
import JoinSessionButton from "@/components/shared/JoinSessionButton";

interface Lesson {
  id: string;
  subject: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  teacher_name: string;
  notes?: string;
  zoom_link?: string;
  schedule_lessons_remaining?: number | null;
}

interface Package {
  package_name: string;
  total_lessons: number;
  used_lessons: number;
  expires_at?: string;
}

interface SchedulesSummary {
  active_schedule_count: number;
  active_lessons_remaining: number;
  source: "schedules" | "package" | "none";
}

interface Me {
  display_name: string;
  email: string;
  phone?: string;
}

interface DashboardData {
  user: Me;
  package: Package | null;
  schedules_summary: SchedulesSummary;
  upcoming_lessons: Lesson[];
}

export default function StudentDashboard() {
  const handleLogout = useLogout();
  const { authChecked } = useAuthGuard(["student"]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<Lesson[]>([]);
  const [skewMs, setSkewMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authChecked) return;
    const token = localStorage.getItem("accessToken");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/students/me", { headers }),
      api.get("/students/lessons", { headers }),
    ])
      .then(([meRes, lessonsRes]) => {
        setData(meRes.data);
        setHistory(lessonsRes.data.lessons);
        setSkewMs(computeClockSkew(lessonsRes.data.server_time));
      })
      .catch(() => setError("Failed to load dashboard. Please sign in again."))
      .finally(() => setLoading(false));
  }, [authChecked]);

  if (loading) {
    return <PageLoading />;
  }

  if (error || !data) {
    return <PageError message={error || "Something went wrong."} showLoginLink />;
  }

  const { user, package: pkg, schedules_summary: summary, upcoming_lessons } = data;
  const pastLessons = history.filter((l) => l.status !== "scheduled");

  const { unit, balanceEmptyMsg, balanceEmptyWa } = getBalanceCopy(summary.source);

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Assalamu Alaikum, {user.display_name.split(" ")[0]} 👋
            </h1>
            <p className="text-charcoal/55 mt-1 text-sm">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Lessons card */}
        <div className={`rounded-2xl p-6 mb-8 ${
          summary.source !== "none" && summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS
            ? "bg-amber-50 border border-amber-200"
            : "bg-emerald-primary text-white"
        }`}>
          <p className={`text-xs uppercase tracking-wider mb-1 ${
            summary.source !== "none" && summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS
              ? "text-amber-600 font-semibold" : "text-white/70"
          }`}>
            {unit === "hour" ? "Hours" : "Lessons"}
          </p>
          {summary.source !== "none" ? (
            <div className="flex items-end justify-between">
              <div>
                <h2 className={`font-display text-2xl font-bold ${
                  summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS ? "text-amber-800" : ""
                }`}>
                  {formatHours(summary.active_lessons_remaining)} {unit}{summary.active_lessons_remaining !== 1 ? "s" : ""} remaining
                </h2>
                <p className={`text-sm mt-1 ${
                  summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS ? "text-amber-600" : "text-white/80"
                }`}>
                  {summary.source === "schedules"
                    ? summary.active_schedule_count > 1
                      ? `Across ${summary.active_schedule_count} active schedules`
                      : "From your current schedule"
                    : "From your package"}
                  {summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS && " — contact us to renew"}
                </p>
              </div>
              {pkg?.expires_at && (
                <p className={`text-xs ${
                  summary.active_lessons_remaining <= RENEWAL_REMINDER_HOURS ? "text-amber-500" : "text-white/60"
                }`}>Expires {formatSimpleDate(pkg.expires_at)}</p>
              )}
            </div>
          ) : (
            <p className="text-white/80">No active package. Contact us to enrol.</p>
          )}
        </div>

        {/* Exam portal */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-charcoal">Exams</p>
            <p className="text-charcoal/55 text-sm mt-0.5">Take your assessments on the MY Institute exam platform.</p>
          </div>
          <a
            href={EXAM_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Student Exam Portal (opens in a new tab)"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors shrink-0 self-start sm:self-auto"
          >
            <ClipboardList size={14} />
            Student Exam Portal
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Upcoming lessons */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Upcoming Lessons</h2>
          {upcoming_lessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No upcoming lessons scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming_lessons.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                      <p className="text-charcoal/55 text-sm mt-0.5">
                        with {l.teacher_name} · {l.duration_minutes} min
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-charcoal">{formatSessionDate(l.scheduled_at)}</p>
                      <p className="text-charcoal/55 text-sm">{formatTimeOnly(l.scheduled_at)}</p>
                    </div>
                  </div>
                  {summary.active_lessons_remaining <= 0 || (l.schedule_lessons_remaining != null && l.schedule_lessons_remaining <= 0) ? (
                    <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-red-700 text-sm font-medium">{balanceEmptyMsg}</p>
                      <a
                        href={whatsAppUrl(BRAND.whatsapp, balanceEmptyWa) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
                      >
                        <MessageCircle size={14} />
                        WhatsApp Admin
                      </a>
                    </div>
                  ) : (
                    <JoinSessionButton
                      zoomLink={l.zoom_link}
                      scheduledAt={l.scheduled_at}
                      skewMs={skewMs}
                      className="mt-3 inline-flex"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lesson history */}
        <section>
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Lesson History</h2>
          {pastLessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No completed lessons yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pastLessons.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                    <p className="text-charcoal/55 text-sm mt-0.5">
                      with {l.teacher_name}
                      {l.notes && <> · <span className="italic">{l.notes}</span></>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                      l.status === "completed"
                        ? "bg-emerald-primary/10 text-emerald-primary"
                        : "bg-red-50 text-red-500"
                    }`}>
                      {l.status}
                    </span>
                    <p className="text-charcoal/40 text-xs mt-1">{formatSessionDate(l.scheduled_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
