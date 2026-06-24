"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Calendar, Clock, User, X, RefreshCw, AlertTriangle, Video, ExternalLink, MessageCircle, List } from "lucide-react";
import { formatSessionDate, formatSessionTime, formatTimeOnly, formatSimpleDate, isSessionStillUpcoming } from "@/lib/datetime";
import { BRAND } from "@/lib/content";
import SessionCalendar from "@/components/shared/SessionCalendar";

interface Session {
  id: string;
  teacher_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  cancellation_reason?: string;
  zoom_link?: string;
  subject?: string;
  schedule_lessons_remaining?: number | null;
}

interface RescheduleRequest {
  id: string;
  session_id: string;
  proposed_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled_by_student";
}

interface SchedulesSummary {
  active_schedule_count: number;
  active_lessons_remaining: number;
  source: "schedules" | "package" | "none";
}

interface Payment {
  id: string;
  amount: string;
  currency: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
}

function subjectLabel(s?: string) {
  if (!s) return "";
  return s === "quran" ? "Quran" : s === "arabic" ? "Arabic" : "Islamic Studies";
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
  const [summary, setSummary] = useState<SchedulesSummary>({ active_schedule_count: 0, active_lessons_remaining: 0, source: "none" });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRequests, setPendingRequests] = useState<RescheduleRequest[]>([]);

  // view mode
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");

  // cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // reschedule request state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [cancellingRequest, setCancellingRequest] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/sessions", { headers }),
      api.get("/students/me", { headers }),
      api.get("/students/payments", { headers }),
      api.get("/reschedule-requests?status=pending", { headers }),
    ])
      .then(([sRes, meRes, payRes, rrRes]) => {
        setSessions(sRes.data.sessions);
        setSummary(meRes.data.schedules_summary ?? { active_schedule_count: 0, active_lessons_remaining: 0, source: "none" });
        setPayments(payRes.data.payments ?? []);
        setPendingRequests(rrRes.data.requests ?? []);
      })
      .catch(() => setError("Failed to load sessions."))
      .finally(() => setLoading(false));
  }, [router]);

  function getPendingRequest(sessionId: string) {
    return pendingRequests.find((r) => r.session_id === sessionId);
  }

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

  async function handleRequestReschedule() {
    if (!rescheduleId || !proposedDate || !proposedTime) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const proposed_at = new Date(`${proposedDate}T${proposedTime}`).toISOString();
    setRescheduleSaving(true);
    setRescheduleError("");
    try {
      const res = await api.post("/reschedule-requests",
        { session_id: rescheduleId, proposed_at },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingRequests((prev) => [...prev, res.data.request]);
      setRescheduleId(null);
      setProposedDate("");
      setProposedTime("");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; error?: string } } };
      const code = e.response?.data?.code;
      const msg = e.response?.data?.error;
      if (code === "CANCELLATION_BUFFER") {
        setRescheduleError("Too close to session start. Please message the admin on WhatsApp to request changes.");
      } else if (code === "TEACHER_CONFLICT") {
        setRescheduleError("Teacher not available at this time. Please choose another.");
      } else if (msg?.includes("already pending")) {
        setRescheduleError("You already have a pending reschedule request for this session.");
      } else {
        setRescheduleError(msg || "Couldn't submit your request. Please try again.");
      }
    } finally {
      setRescheduleSaving(false);
    }
  }

  async function handleCancelRequest(requestId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setCancellingRequest(requestId);
    try {
      await api.delete(`/reschedule-requests/${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      alert("Failed to cancel request.");
    } finally {
      setCancellingRequest(null);
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
    (s) => s.status === "scheduled" && isSessionStillUpcoming(s.scheduled_at, s.duration_minutes)
  );
  const past = sessions.filter((s) => s.status !== "scheduled" || !isSessionStillUpcoming(s.scheduled_at, s.duration_minutes));

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, "0");
    const m = i % 2 === 0 ? "00" : "30";
    return `${h}:${m}`;
  });

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-3xl font-bold text-charcoal">My Sessions</h1>
          <div className="flex rounded-lg border border-black/10 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "list" ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:bg-black/5"
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "calendar" ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:bg-black/5"
              }`}
            >
              <Calendar size={13} /> Calendar
            </button>
          </div>
        </div>
        <p className="text-charcoal/50 text-sm mb-8">Manage your upcoming and past sessions</p>

        {/* Lessons remaining bar */}
        {summary.source !== "none" && (
          <div className={`rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 ${
            summary.active_lessons_remaining <= 2
              ? "bg-amber-50 border border-amber-200"
              : "bg-emerald-primary text-white"
          }`}>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                summary.active_lessons_remaining <= 2 ? "text-amber-600" : "text-white/70"
              }`}>
                {summary.active_lessons_remaining <= 2
                  ? "⚠ Renewal Reminder"
                  : "Lessons"}
              </p>
              <p className={`font-semibold ${
                summary.active_lessons_remaining <= 2 ? "text-amber-800" : "text-white"
              }`}>
                {summary.active_lessons_remaining} lesson{summary.active_lessons_remaining !== 1 ? "s" : ""} remaining
                {summary.active_lessons_remaining <= 2 && " — contact us to renew"}
              </p>
              <p className={`text-xs mt-1 ${summary.active_lessons_remaining <= 2 ? "text-amber-600" : "text-white/60"}`}>
                {summary.source === "schedules"
                  ? summary.active_schedule_count > 1
                    ? `Across ${summary.active_schedule_count} active schedules`
                    : "From your current schedule"
                  : "From your package"}
              </p>
            </div>
            {summary.active_lessons_remaining <= 2 && (
              <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            )}
          </div>
        )}

        {/* Calendar view */}
        {viewMode === "calendar" && (
          <section className="mb-10">
            <SessionCalendar
              sessions={sessions}
              mode={calendarMode}
              onModeChange={setCalendarMode}
              nameField="teacher_name"
            />
          </section>
        )}

        {/* List view */}
        {viewMode === "list" && <>
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
              {upcoming.map((s) => {
                const pendingReq = getPendingRequest(s.id);
                return (
                <div key={s.id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-charcoal">
                        <User size={14} className="text-charcoal/40" />
                        <span className="font-semibold text-sm">{s.teacher_name}</span>
                        {s.subject && (
                          <span className="text-xs text-charcoal/40">· {subjectLabel(s.subject)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-charcoal/55 text-sm">
                        <Calendar size={14} />
                        <span>{formatSessionDate(s.scheduled_at)}</span>
                        <Clock size={14} className="ml-1" />
                        <span>{formatTimeOnly(s.scheduled_at)} · {s.duration_minutes} min</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-primary/10 text-emerald-primary">
                      Scheduled
                    </span>
                  </div>

                  {/* Pending reschedule badge */}
                  {pendingReq && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-amber-700 text-sm font-medium">Reschedule requested — awaiting approval</p>
                      <p className="text-amber-600 text-xs mt-1">
                        Proposed: {formatSessionTime(pendingReq.proposed_at)}
                      </p>
                      <button
                        onClick={() => handleCancelRequest(pendingReq.id)}
                        disabled={cancellingRequest === pendingReq.id}
                        className="mt-2 text-xs text-amber-600 hover:text-amber-800 underline disabled:opacity-50"
                      >
                        {cancellingRequest === pendingReq.id ? "Cancelling…" : "Cancel request"}
                      </button>
                    </div>
                  )}

                  {/* Join Class button — gated by lesson balance */}
                  {summary.active_lessons_remaining === 0 || s.schedule_lessons_remaining === 0 ? (
                    <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-red-700 text-sm font-medium">Your lesson balance is 0. Please contact admin to renew.</p>
                      <a
                        href={`https://wa.me/${BRAND.whatsapp.replace("+", "")}?text=${encodeURIComponent("Hi, my lesson balance has reached 0. I'd like to renew.")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors w-fit"
                      >
                        <MessageCircle size={14} />
                        WhatsApp Admin
                      </a>
                    </div>
                  ) : s.zoom_link ? (
                    <a
                      href={s.zoom_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-3 flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors w-fit"
                    >
                      <Video size={14} />
                      Join Class
                      <ExternalLink size={12} />
                    </a>
                  ) : null}

                  {/* Actions — check 12h buffer */}
                  {(() => {
                    const hoursUntil = (new Date(s.scheduled_at).getTime() - Date.now()) / 3600000;
                    const withinBuffer = hoursUntil >= 0 && hoursUntil < 12;
                    const waText = `Hi, I need to change my session on ${formatSessionTime(s.scheduled_at)}.`;
                    const waUrl = `https://wa.me/${BRAND.whatsapp.replace("+", "")}?text=${encodeURIComponent(waText)}`;

                    if (withinBuffer && !pendingReq) {
                      return (
                        <div className="border-t border-black/5 pt-3">
                          <p className="text-charcoal/60 text-sm mb-2">
                            This session starts soon and can no longer be changed online. Please message Mohammad to request changes.
                          </p>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
                          >
                            <MessageCircle size={14} />
                            WhatsApp Mohammad →
                          </a>
                        </div>
                      );
                    }

                    if (cancelId === s.id) {
                      return (
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
                      );
                    }

                    if (rescheduleId === s.id) {
                      return (
                        <div className="border-t border-black/5 pt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={proposedDate}
                              onChange={(e) => setProposedDate(e.target.value)}
                              min={new Date().toISOString().split("T")[0]}
                              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            />
                            <select
                              value={proposedTime}
                              onChange={(e) => setProposedTime(e.target.value)}
                              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            >
                              <option value="">Select time…</option>
                              {timeOptions.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          {rescheduleError && (
                            <p className="text-red-500 text-xs">{rescheduleError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleRequestReschedule}
                              disabled={rescheduleSaving || !proposedDate || !proposedTime}
                              className="px-4 py-1.5 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                            >
                              {rescheduleSaving ? "Submitting…" : "Submit Request"}
                            </button>
                            <button
                              onClick={() => { setRescheduleId(null); setProposedDate(""); setProposedTime(""); setRescheduleError(""); }}
                              className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (!pendingReq) {
                      return (
                        <div className="flex gap-2 border-t border-black/5 pt-3">
                          <button
                            onClick={() => setRescheduleId(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-emerald-primary/40 hover:text-emerald-primary transition-colors"
                          >
                            <RefreshCw size={13} /> Request Reschedule
                          </button>
                          <button
                            onClick={() => setCancelId(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-red-300 hover:text-red-500 transition-colors"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
                );
              })}
            </div>
          )}
        </section>

        {/* History */}
        <section className="mb-10">
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
                    <p className="font-semibold text-charcoal text-sm">{s.teacher_name}
                      {s.subject && <span className="text-charcoal/40 font-normal"> · {subjectLabel(s.subject)}</span>}
                    </p>
                    <p className="text-charcoal/50 text-xs mt-0.5">
                      {formatSessionTime(s.scheduled_at)}
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

        {/* Payment History */}
        {payments.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-charcoal mb-4">Payment History</h2>
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal text-sm">
                      {p.currency}{parseFloat(p.amount).toFixed(2)}
                      {p.payment_method && <span className="text-charcoal/40 font-normal"> · {p.payment_method}</span>}
                    </p>
                    {p.notes && <p className="text-charcoal/50 text-xs mt-0.5">{p.notes}</p>}
                  </div>
                  <p className="text-charcoal/40 text-xs shrink-0">
                    {formatSimpleDate(p.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        </>}
      </div>
    </main>
  );
}
