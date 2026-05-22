"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface TeacherHours {
  teacher_id: string;
  display_name: string;
  completed_sessions: number;
  total_minutes: number;
  total_hours: number;
  cancelled_sessions: number;
  rescheduled_sessions: number;
}

function getMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(str: string) {
  const [y, m] = str.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function TeacherHoursPage() {
  const router = useRouter();
  const [month, setMonth] = useState(getMonthStr(new Date()));
  const [teachers, setTeachers] = useState<TeacherHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role !== "admin" && role !== "supervisor") {
      router.push("/login");
      return;
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/teacher-hours?month=${month}`)
      .then((res) => {
        setTeachers(res.data.teachers);
        setError("");
      })
      .catch(() => setError("Failed to load teacher hours"))
      .finally(() => setLoading(false));
  }, [month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMonth(getMonthStr(d));
  };

  const totalHours = teachers.reduce((sum, t) => sum + t.total_hours, 0);
  const totalSessions = teachers.reduce(
    (sum, t) => sum + t.completed_sessions,
    0
  );
  const hasActivity = teachers.some(
    (t) => t.completed_sessions > 0 || t.cancelled_sessions > 0 || t.rescheduled_sessions > 0
  );

  return (
    <main className="min-h-screen bg-cream pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="font-display text-3xl font-bold text-charcoal mb-1"
            data-testid="page-title"
          >
            Teacher Hours
          </h1>
          <p className="text-charcoal/50 text-sm">
            Monthly teaching hours for salary calculation.
          </p>
        </div>

        {/* Month selector */}
        <div
          className="flex items-center gap-4 mb-8"
          data-testid="month-selector"
        >
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg border border-black/10 hover:bg-white transition-colors"
            aria-label="Previous month"
            data-testid="prev-month"
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="font-display text-lg font-semibold text-charcoal min-w-[160px] text-center"
            data-testid="current-month"
          >
            {formatMonth(month)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg border border-black/10 hover:bg-white transition-colors"
            aria-label="Next month"
            data-testid="next-month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-charcoal/40">Loading…</div>
        ) : !hasActivity ? (
          <div
            className="text-center py-20 text-charcoal/40"
            data-testid="empty-state"
          >
            No teaching hours recorded for {formatMonth(month)} yet.
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div
              className="bg-white rounded-2xl border border-black/5 p-5 mb-6 flex items-center justify-between"
              data-testid="summary-bar"
            >
              <div>
                <span className="text-charcoal/50 text-sm">
                  Total across all teachers
                </span>
                <div className="flex items-baseline gap-4 mt-1">
                  <span
                    className="font-display text-2xl font-bold text-emerald-primary"
                    data-testid="total-hours"
                  >
                    {Math.round(totalHours * 10) / 10}h
                  </span>
                  <span className="text-charcoal/40 text-sm">
                    {totalSessions} completed session
                    {totalSessions !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <Clock size={28} className="text-emerald-primary/30" />
            </div>

            {/* Teacher rows */}
            <div className="space-y-3" data-testid="teacher-list">
              {teachers.map((t) => (
                <div
                  key={t.teacher_id}
                  className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between"
                  data-testid="teacher-row"
                >
                  <div>
                    <h3
                      className="font-semibold text-charcoal"
                      data-testid="teacher-name"
                    >
                      {t.display_name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-charcoal/50">
                        {t.completed_sessions} completed
                      </span>
                      {t.cancelled_sessions > 0 && (
                        <span
                          className="text-charcoal/35"
                          data-testid="cancelled-count"
                        >
                          {t.cancelled_sessions} cancelled
                        </span>
                      )}
                      {t.rescheduled_sessions > 0 && (
                        <span className="text-charcoal/35">
                          {t.rescheduled_sessions} rescheduled
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-display text-2xl font-bold text-emerald-primary"
                    data-testid="teacher-hours"
                  >
                    {t.total_hours}h
                  </span>
                </div>
              ))}
            </div>

            {/* Note */}
            <p className="text-charcoal/30 text-xs mt-6 text-center">
              Only completed sessions count toward paid hours. Cancelled and
              rescheduled sessions are shown for context.
            </p>
            <p className="text-charcoal/30 text-xs mt-1 text-center">
              To auto-calculate salary, a per-teacher pay rate field would need
              to be added in a future update.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
