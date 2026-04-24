"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Calendar, Clock, User, X, RefreshCw, AlertTriangle } from "lucide-react";

interface Session {
  id: string;
  teacher_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  cancellation_reason?: string;
}

interface Pkg {
  package_name: string;
  sessions_remaining: number | null;
  total_lessons: number;
  renewal_reminder_sent: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const statusStyle: Record<string, string> = {
  scheduled: "bg-emerald-primary/10 text-emerald-primary",
  completed: "bg-blue-50 text-blue-600",
  cancelled: "bg-red-50 text-red-500",
  rescheduled: "bg-amber-50 text-amber-600",
};

export default function StudentSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // reschedule state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/sessions", { headers }),
      api.get("/students/me", { headers }),
    ])
      .then(([sRes, meRes]) => {
        setSessions(sRes.data.sessions);
        setPkg(meRes.data.package ?? null);
      })
      .catch(() => setError("Failed to load sessions."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCancel() {
    if (!cancelId) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setCancelSaving(true);
    try {
      await api.patch(`/sessions/${cancelId}/cancel`,
        { cancellation_reason: cancelReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessions((prev) =>
        prev.map((s) => s.id === cancelId ? { ...s, status: "cancelled", cancellation_reason: cancelReason } : s)
      );
      setCancelId(null);
      setCancelReason("");
    } catch {
      alert("Failed to cancel session.");
    } finally {
      setCancelSaving(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleId || !newDate) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setRescheduleSaving(true);
    try {
      const res = await api.patch(`/sessions/${rescheduleId}/reschedule`,
        { scheduled_at: new Date(newDate).toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessions((prev) => [
        ...prev.map((s) => s.id === rescheduleId ? { ...s, status: "rescheduled" as const } : s),
        res.data.session,
      ]);
      setRescheduleId(null);
      setNewDate("");
    } catch {
      alert("Failed to reschedule session.");
    } finally {
      setRescheduleSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  const upcoming = sessions.filter(
    (s) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date()
  );
  const past = sessions.filter((s) => s.status !== "scheduled" || new Date(s.scheduled_at) <= new Date());

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">My Sessions</h1>
        <p className="text-charcoal/50 text-sm mb-8">Manage your upcoming and past sessions</p>

        {/* Package / sessions remaining */}
        {pkg && (
          <div className={`rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 ${
            pkg.sessions_remaining !== null && pkg.sessions_remaining <= 2
              ? "bg-amber-50 border border-amber-200"
              : "bg-emerald-primary text-white"
          }`}>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                pkg.sessions_remaining !== null && pkg.sessions_remaining <= 2
                  ? "text-amber-600" : "text-white/70"
              }`}>
                {pkg.sessions_remaining !== null && pkg.sessions_remaining <= 2
                  ? "⚠ Renewal Reminder" : `Package · ${pkg.package_name}`}
              </p>
              {pkg.sessions_remaining !== null ? (
                <p className={`font-semibold ${
                  pkg.sessions_remaining <= 2 ? "text-amber-800" : "text-white"
                }`}>
                  {pkg.sessions_remaining} session{pkg.sessions_remaining !== 1 ? "s" : ""} remaining
                  {pkg.sessions_remaining <= 2 && " — contact us to renew"}
                </p>
              ) : (
                <p className="text-white/80 text-sm">{pkg.total_lessons} lessons in package</p>
              )}
            </div>
            {pkg.sessions_remaining !== null && pkg.sessions_remaining <= 2 && (
              <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            )}
          </div>
        )}

        {/* Upcoming */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">
            Upcoming Sessions
            <span className="ml-2 text-sm font-normal text-charcoal/40">({upcoming.length})</span>
          </h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/40 text-sm">
              No upcoming sessions scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-charcoal">
                        <User size={14} className="text-charcoal/40" />
                        <span className="font-semibold text-sm">{s.teacher_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-charcoal/55 text-sm">
                        <Calendar size={14} />
                        <span>{formatDate(s.scheduled_at)}</span>
                        <Clock size={14} className="ml-1" />
                        <span>{formatTime(s.scheduled_at)} · {s.duration_minutes} min</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-primary/10 text-emerald-primary">
                      Scheduled
                    </span>
                  </div>

                  {/* Actions */}
                  {cancelId === s.id ? (
                    <div className="border-t border-black/5 pt-3 space-y-2">
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancellation (optional)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={cancelSaving}
                          className="px-4 py-1.5 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                        >
                          {cancelSaving ? "Cancelling…" : "Confirm Cancel"}
                        </button>
                        <button
                          onClick={() => { setCancelId(null); setCancelReason(""); }}
                          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                        >
                          Keep session
                        </button>
                      </div>
                    </div>
                  ) : rescheduleId === s.id ? (
                    <div className="border-t border-black/5 pt-3 space-y-2">
                      <input
                        type="datetime-local"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleReschedule}
                          disabled={rescheduleSaving || !newDate}
                          className="px-4 py-1.5 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                        >
                          {rescheduleSaving ? "Rescheduling…" : "Confirm Reschedule"}
                        </button>
                        <button
                          onClick={() => { setRescheduleId(null); setNewDate(""); }}
                          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 border-t border-black/5 pt-3">
                      <button
                        onClick={() => setRescheduleId(s.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-emerald-primary/40 hover:text-emerald-primary transition-colors"
                      >
                        <RefreshCw size={13} /> Reschedule
                      </button>
                      <button
                        onClick={() => setCancelId(s.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Session History</h2>
          {past.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/40 text-sm">
              No past sessions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {past.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal text-sm">{s.teacher_name}</p>
                    <p className="text-charcoal/50 text-xs mt-0.5">
                      {formatDate(s.scheduled_at)} · {formatTime(s.scheduled_at)}
                    </p>
                    {s.cancellation_reason && (
                      <p className="text-charcoal/40 text-xs mt-0.5 italic">{s.cancellation_reason}</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[s.status]}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
