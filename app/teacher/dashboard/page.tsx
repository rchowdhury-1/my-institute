"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Video, ExternalLink, RefreshCw, X as XIcon, CheckCircle2, XCircle, UserCheck, UserX, Calendar, List } from "lucide-react";
import { formatSessionDate, formatTimeOnly, formatSessionTime, formatRelative } from "@/lib/datetime";
import SessionCalendar from "@/components/shared/SessionCalendar";

interface Lesson {
  id: string;
  subject: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  student_name: string;
  notes?: string;
  zoom_link?: string;
  teacher_attended?: boolean | null;
  student_attended?: boolean | null;
  schedule_id?: string | null;
  schedule_lessons_remaining?: number | null;
}

interface Teacher {
  display_name: string;
  email: string;
}

interface RescheduleRequest {
  id: string;
  session_id: string;
  proposed_at: string;
  status: string;
  original_scheduled_at: string;
  duration_minutes: number;
  subject: string;
  student_name: string;
  student_phone: string;
  teacher_name: string;
  created_at: string;
}

function subjectLabel(s: string) {
  return s === "quran" ? "Quran" : s === "arabic" ? "Arabic" : "Islamic Studies";
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}


export default function TeacherDashboard() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [rrActioning, setRrActioning] = useState<string | null>(null);
  const [rrRejectId, setRrRejectId] = useState<string | null>(null);
  const [rrRejectReason, setRrRejectReason] = useState("");
  const [rrResult, setRrResult] = useState<Record<string, { action: "approved" | "rejected"; phone?: string; proposedAt?: string; originalAt?: string; reason?: string }>>({});
  const [rrError, setRrError] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/teachers/me", { headers }),
      api.get("/teachers/lessons", { headers }),
      api.get("/reschedule-requests?status=pending", { headers }),
    ])
      .then(([meRes, lessonsRes, rrRes]) => {
        setTeacher(meRes.data.user);
        setLessons(lessonsRes.data.lessons);
        setRescheduleRequests(rrRes.data.requests ?? []);
      })
      .catch(() => setError("Failed to load dashboard. Please sign in again."))
      .finally(() => setLoading(false));
  }, [router]);

  const markAttendance = async (lessonId: string, teacherAttended: boolean, studentAttended: boolean) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSaving(lessonId);
    try {
      const res = await api.patch(
        `/sessions/${lessonId}/attendance`,
        { teacher_attended: teacherAttended, student_attended: studentAttended },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLessons((prev) => prev.map((l) => l.id === lessonId ? { ...l, ...res.data.session } : l));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; code?: string } } };
      if (e.response?.data?.code === "ATTENDANCE_TOO_EARLY") {
        alert("Attendance can only be marked from 15 minutes before the session.");
      } else if (e.response?.data?.code === "ATTENDANCE_WINDOW_CLOSED") {
        alert("Attendance window has closed (24 hours after session). Contact admin.");
      } else {
        alert(e.response?.data?.error || "Failed to mark attendance.");
      }
    } finally {
      setSaving(null);
    }
  };

  const cancelLesson = async (lessonId: string) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSaving(lessonId);
    try {
      const res = await api.patch(
        `/sessions/${lessonId}/cancel`,
        { cancellation_reason: "Cancelled by teacher" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLessons((prev) => prev.map((l) => l.id === lessonId ? { ...l, ...res.data.session } : l));
    } catch {
      alert("Failed to cancel session.");
    } finally {
      setSaving(null);
    }
  };

  async function handleApproveRequest(rr: RescheduleRequest) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setRrActioning(rr.id);
    setRrError((p) => ({ ...p, [rr.id]: "" }));
    try {
      await api.patch(`/reschedule-requests/${rr.id}/approve`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRescheduleRequests((prev) => prev.filter((r) => r.id !== rr.id));
      setRrResult((p) => ({ ...p, [rr.id]: { action: "approved", phone: rr.student_phone, proposedAt: rr.proposed_at } }));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; error?: string } } };
      if (e.response?.data?.code === "TEACHER_CONFLICT") {
        setRrError((p) => ({ ...p, [rr.id]: "Conflict detected — another session has been scheduled at this time. Please reject this request." }));
      } else {
        setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to approve." }));
      }
    } finally {
      setRrActioning(null);
    }
  }

  async function handleRejectRequest(rr: RescheduleRequest) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setRrActioning(rr.id);
    try {
      await api.patch(`/reschedule-requests/${rr.id}/reject`,
        { rejection_reason: rrRejectReason || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRescheduleRequests((prev) => prev.filter((r) => r.id !== rr.id));
      setRrResult((p) => ({ ...p, [rr.id]: { action: "rejected", phone: rr.student_phone, originalAt: rr.original_scheduled_at, reason: rrRejectReason } }));
      setRrRejectId(null);
      setRrRejectReason("");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to reject." }));
    } finally {
      setRrActioning(null);
    }
  }

  function whatsAppUrl(phone: string | undefined, message: string) {
    const num = (phone || "").replace(/[^0-9]/g, "");
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  }

  const handleLogout = async () => {
    await api.post("/auth/logout", {}).catch(() => {});
    localStorage.clear();
    document.cookie = "userRole=; path=/; max-age=0";
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !teacher) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Something went wrong."}</p>
          <a href="/login" className="text-emerald-primary font-medium hover:underline">Back to login</a>
        </div>
      </main>
    );
  }

  const todayLessons = lessons.filter((l) => isToday(l.scheduled_at));
  const upcomingLessons = lessons.filter(
    (l) => l.status === "scheduled" && new Date(l.scheduled_at) > new Date()
  );

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Assalamu Alaikum, {teacher.display_name.split(" ")[0]}
            </h1>
            <p className="text-charcoal/55 mt-1 text-sm">{teacher.email}</p>
          </div>
          <div className="flex items-center gap-3">
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
            <button
              onClick={handleLogout}
              className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Calendar view */}
        {viewMode === "calendar" && (
          <section className="mb-10">
            <SessionCalendar
              sessions={lessons}
              mode={calendarMode}
              onModeChange={setCalendarMode}
              nameField="student_name"
            />
          </section>
        )}

        {viewMode === "list" && <>
        {/* Reschedule Requests */}
        {(rescheduleRequests.length > 0 || Object.keys(rrResult).length > 0) && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
              <RefreshCw size={18} className="text-amber-500" />
              Reschedule Requests
              {rescheduleRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  {rescheduleRequests.length}
                </span>
              )}
            </h2>
            <div className="space-y-3">
              {rescheduleRequests.map((rr) => (
                <div key={rr.id} className="bg-white rounded-2xl border border-amber-200 p-5">
                  <div className="space-y-1 mb-3">
                    <p className="font-semibold text-charcoal text-sm">{rr.student_name}</p>
                    <p className="text-charcoal/50 text-xs">
                      Current: {formatSessionTime(rr.original_scheduled_at)}
                    </p>
                    <p className="text-emerald-primary text-xs font-medium">
                      Proposed: {formatSessionTime(rr.proposed_at)}
                    </p>
                    <p className="text-charcoal/30 text-xs">{formatRelative(rr.created_at)}</p>
                  </div>
                  {rrRejectId === rr.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rrRejectReason}
                        onChange={(e) => setRrRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleRejectRequest(rr)} disabled={rrActioning === rr.id}
                          className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                          {rrActioning === rr.id ? "Rejecting…" : "Confirm Reject"}
                        </button>
                        <button onClick={() => { setRrRejectId(null); setRrRejectReason(""); }}
                          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveRequest(rr)} disabled={rrActioning === rr.id}
                        className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                        {rrActioning === rr.id ? "…" : "Approve"}
                      </button>
                      <button onClick={() => setRrRejectId(rr.id)} disabled={rrActioning === rr.id}
                        className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-semibold hover:border-red-300 hover:text-red-500 disabled:opacity-60 transition-colors">
                        Reject
                      </button>
                    </div>
                  )}
                  {rrError[rr.id] && <p className="mt-2 text-red-500 text-xs">{rrError[rr.id]}</p>}
                </div>
              ))}
              {Object.entries(rrResult).map(([id, result]) => {
                const waMsg = result.action === "approved"
                  ? `Assalamu alaikum! Your session has been rescheduled to ${formatSessionTime(result.proposedAt || "")}. See you then insha'Allah! — My Institute`
                  : `Assalamu alaikum, unfortunately your reschedule request for ${formatSessionTime(result.originalAt || "")} could not be approved.${result.reason ? ` ${result.reason}` : ""} Please contact us to arrange an alternative. — My Institute`;
                const url = whatsAppUrl(result.phone, waMsg);
                return (
                  <div key={id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                    <p className={`text-sm font-medium ${result.action === "approved" ? "text-emerald-primary" : "text-charcoal/60"}`}>
                      {result.action === "approved" ? "Approved ✓" : "Rejected"}
                    </p>
                    <div className="flex items-center gap-2">
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors">
                          Send WhatsApp to student →
                        </a>
                      )}
                      <button onClick={() => setRrResult((p) => { const n = { ...p }; delete n[id]; return n; })}
                        className="text-charcoal/30 hover:text-charcoal/60 transition-colors">
                        <XIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today's schedule */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">
            Today&apos;s Schedule
            <span className="ml-2 text-sm font-normal text-charcoal/40">
              {todayLessons.length} lesson{todayLessons.length !== 1 ? "s" : ""}
            </span>
          </h2>
          {todayLessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No lessons scheduled for today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  noteInput={noteInputs[l.id] ?? l.notes ?? ""}
                  saving={saving === l.id}
                  onNoteChange={(val) => setNoteInputs((p) => ({ ...p, [l.id]: val }))}
                  onAttendance={(ta, sa) => markAttendance(l.id, ta, sa)}
                  onCancel={() => cancelLesson(l.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Upcoming Lessons</h2>
          {upcomingLessons.filter((l) => !isToday(l.scheduled_at)).length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No upcoming lessons.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingLessons
                .filter((l) => !isToday(l.scheduled_at))
                .map((l) => (
                  <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                        <p className="text-charcoal/55 text-sm mt-0.5">with {l.student_name} · {l.duration_minutes} min</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-charcoal">{formatSessionDate(l.scheduled_at)}</p>
                        <p className="text-charcoal/55 text-sm">{formatTimeOnly(l.scheduled_at)}</p>
                      </div>
                    </div>
                    {l.zoom_link && (
                      <a
                        href={l.zoom_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
                      >
                        <Video size={14} />
                        Join Session
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {l.schedule_lessons_remaining === 0 && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Student&apos;s lesson balance is 0 — renewal needed
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
        </>}
      </div>
    </main>
  );
}

function LessonCard({
  lesson, noteInput, saving, onNoteChange, onAttendance, onCancel,
}: {
  lesson: Lesson;
  noteInput: string;
  saving: boolean;
  onNoteChange: (v: string) => void;
  onAttendance: (teacherAttended: boolean, studentAttended: boolean) => void;
  onCancel: () => void;
}) {
  const [attendanceStep, setAttendanceStep] = useState<null | "teacher" | "student">(null);
  const done = lesson.status !== "scheduled";
  const now = new Date();
  const sessionStart = new Date(lesson.scheduled_at);
  const windowStart = new Date(sessionStart.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(sessionStart.getTime() + 24 * 60 * 60 * 1000);
  const inWindow = now >= windowStart && now <= windowEnd;
  const isPast = now > sessionStart;

  const statusLabel: Record<string, string> = {
    completed: "Completed",
    no_show: "No Show",
    cancelled: "Cancelled",
    cancelled_teacher: "Teacher Cancelled",
    rescheduled: "Rescheduled",
  };

  const statusColor: Record<string, string> = {
    completed: "bg-emerald-primary/10 text-emerald-primary",
    no_show: "bg-orange-50 text-orange-600",
    cancelled: "bg-red-50 text-red-500",
    cancelled_teacher: "bg-red-50 text-red-500",
    rescheduled: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold text-charcoal">{subjectLabel(lesson.subject)}</p>
          <p className="text-charcoal/55 text-sm mt-0.5">
            with {lesson.student_name} · {lesson.duration_minutes} min · {formatTimeOnly(lesson.scheduled_at)}
          </p>
        </div>
        {done && (
          <div className="shrink-0 flex items-center gap-2">
            {lesson.teacher_attended != null && (
              <div className="flex items-center gap-1 text-xs text-charcoal/40">
                {lesson.teacher_attended ? <CheckCircle2 size={12} className="text-emerald-primary" /> : <XCircle size={12} className="text-red-400" />}
                T
                {lesson.student_attended != null && (
                  <>
                    {lesson.student_attended ? <CheckCircle2 size={12} className="text-emerald-primary" /> : <XCircle size={12} className="text-red-400" />}
                    S
                  </>
                )}
              </div>
            )}
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[lesson.status] ?? "bg-gray-100 text-gray-600"}`}>
              {statusLabel[lesson.status] ?? lesson.status}
            </span>
          </div>
        )}
      </div>

      {!done && lesson.zoom_link && (
        <a
          href={lesson.zoom_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
        >
          <Video size={14} />
          Join Session
          <ExternalLink size={12} />
        </a>
      )}

      {!done && lesson.schedule_lessons_remaining === 0 && (
        <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Student&apos;s lesson balance is 0 — renewal needed
        </p>
      )}

      {!done && (
        <>
          <textarea
            value={noteInput}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add lesson notes (optional)…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm resize-none mb-3"
          />

          {/* Attendance flow */}
          {attendanceStep === null && (
            <div className="flex gap-2">
              {inWindow ? (
                <button
                  onClick={() => setAttendanceStep("teacher")}
                  disabled={saving}
                  className="flex-1 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors disabled:opacity-60"
                >
                  Mark Attendance
                </button>
              ) : isPast ? (
                <p className="text-charcoal/40 text-xs py-2">Attendance window closed — contact admin</p>
              ) : (
                <p className="text-charcoal/40 text-xs py-2">Attendance available from 15 min before session</p>
              )}
              <button
                onClick={onCancel}
                disabled={saving}
                className="px-4 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )}

          {attendanceStep === "teacher" && (
            <div className="bg-cream/50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-charcoal">Did you attend this session?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAttendanceStep("student")}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors disabled:opacity-60"
                >
                  <UserCheck size={14} /> Yes, I attended
                </button>
                <button
                  onClick={() => { onAttendance(false, false); setAttendanceStep(null); }}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  <UserX size={14} /> No
                </button>
              </div>
              <button onClick={() => setAttendanceStep(null)} className="text-charcoal/40 text-xs hover:text-charcoal/60">
                ← Back
              </button>
            </div>
          )}

          {attendanceStep === "student" && (
            <div className="bg-cream/50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-charcoal">Did the student attend?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onAttendance(true, true); setAttendanceStep(null); }}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 size={14} /> Yes
                </button>
                <button
                  onClick={() => { onAttendance(true, false); setAttendanceStep(null); }}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  <XCircle size={14} /> No (No-Show)
                </button>
              </div>
              <button onClick={() => setAttendanceStep("teacher")} className="text-charcoal/40 text-xs hover:text-charcoal/60">
                ← Back
              </button>
            </div>
          )}
        </>
      )}

      {done && lesson.notes && (
        <p className="text-charcoal/50 text-sm italic border-t border-black/5 pt-3">{lesson.notes}</p>
      )}
    </div>
  );
}
